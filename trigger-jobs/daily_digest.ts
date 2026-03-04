import { task, cronTrigger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Type definitions
interface ScheduleItem {
  serviceId: string;
  customerName: string;
  address: string;
  serviceType: string;
  scheduledTime: string;
  estimatedDuration: number;
  priority: "high" | "medium" | "low";
}

interface DailyTaskList {
  repId: string;
  date: string;
  tasks: ScheduleItem[];
  totalTasks: number;
  estimatedHours: number;
}

// Fetch tomorrow's schedule from JDE service scheduler
async function fetchTomorrowsSchedule(): Promise<
  Map<string, ScheduleItem[]>
> {
  const repSchedules = new Map<string, ScheduleItem[]>();

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    // Fetch all schedules for tomorrow from JDE
    const response = await axios.get(
      `${process.env.JDE_API_URL}/service-schedules`,
      {
        params: {
          date: tomorrowDate,
          status: "scheduled",
        },
        headers: {
          Authorization: `Bearer ${process.env.JDE_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const schedules = response.data.schedules || [];

    // Group by rep
    for (const schedule of schedules) {
      const repId = schedule.assignedRepId;

      if (!repSchedules.has(repId)) {
        repSchedules.set(repId, []);
      }

      repSchedules.get(repId)!.push({
        serviceId: schedule.serviceId,
        customerName: schedule.customerName,
        address: schedule.address,
        serviceType: schedule.serviceType,
        scheduledTime: schedule.scheduledTime,
        estimatedDuration: schedule.estimatedDuration,
        priority: schedule.priority || "medium",
      });
    }

    // Sort each rep's schedule by time
    for (const [, tasks] of repSchedules) {
      tasks.sort(
        (a, b) =>
          new Date(a.scheduledTime).getTime() -
          new Date(b.scheduledTime).getTime()
      );
    }

    console.log(
      `Fetched schedules for ${repSchedules.size} reps for ${tomorrowDate}`
    );
    return repSchedules;
  } catch (error) {
    console.error("Failed to fetch tomorrow's schedule from JDE:", error);
    return repSchedules;
  }
}

// Get all active reps in system
async function getAllActiveReps(): Promise<
  Array<{ id: string; email: string; pushToken?: string; division: string }>
> {
  try {
    const { data: reps } = await supabase
      .from("reps")
      .select("id, email, push_token, division_id")
      .eq("is_active", true);

    if (!reps) return [];

    return reps.map((rep) => ({
      id: rep.id,
      email: rep.email,
      pushToken: rep.push_token || undefined,
      division: rep.division_id,
    }));
  } catch (error) {
    console.error("Failed to fetch active reps:", error);
    return [];
  }
}

// Build daily task list
function buildDailyTaskList(repId: string, tasks: ScheduleItem[]): DailyTaskList {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const totalDuration = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);

  return {
    repId,
    date: tomorrowDate,
    tasks,
    totalTasks: tasks.length,
    estimatedHours: Math.round((totalDuration / 60) * 10) / 10, // Convert minutes to hours
  };
}

// Send task preview notification (push)
async function sendTaskPreviewNotification(
  repId: string,
  taskCount: number,
  estimatedHours: number,
  pushToken?: string
): Promise<void> {
  try {
    if (!pushToken) {
      console.log(`No push token available for rep ${repId}`);
      return;
    }

    const message = `You have ${taskCount} scheduled task${taskCount !== 1 ? "s" : ""} tomorrow (${estimatedHours} hrs estimated)`;

    await axios.post(`${process.env.PUSH_SERVICE_URL}/send`, {
      token: pushToken,
      title: "Tomorrow's Tasks Ready",
      message,
      data: {
        type: "daily_digest",
        taskCount,
        estimatedHours,
      },
    });

    console.log(`Sent task preview notification to rep ${repId}`);
  } catch (error) {
    console.error(
      `Failed to send task preview notification to rep ${repId}:`,
      error
    );
  }
}

// Send email digest
async function sendTaskDigestEmail(
  repId: string,
  repEmail: string,
  taskList: DailyTaskList
): Promise<void> {
  try {
    await axios.post(
      `${process.env.API_URL}/emails/daily-digest`,
      {
        repId,
        repEmail,
        date: taskList.date,
        tasks: taskList.tasks,
        totalTasks: taskList.totalTasks,
        estimatedHours: taskList.estimatedHours,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
      }
    );

    console.log(`Sent daily digest email to ${repEmail}`);
  } catch (error) {
    console.error(
      `Failed to send daily digest email for rep ${repId}:`,
      error
    );
  }
}

// Update task table with tomorrow's schedule
async function updateTaskTable(taskList: DailyTaskList): Promise<void> {
  try {
    // First, mark today's tasks as archived/completed if not done
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("tasks")
      .update({ archived: true })
      .eq("rep_id", taskList.repId)
      .lte("scheduled_date", today);

    // Insert tomorrow's tasks
    const tasksToInsert = taskList.tasks.map((task) => ({
      rep_id: taskList.repId,
      service_id: task.serviceId,
      customer_name: task.customerName,
      address: task.address,
      service_type: task.serviceType,
      scheduled_time: task.scheduledTime,
      estimated_duration_minutes: task.estimatedDuration,
      priority: task.priority,
      scheduled_date: taskList.date,
      completed: false,
      created_at: new Date().toISOString(),
    }));

    if (tasksToInsert.length > 0) {
      await supabase.from("tasks").insert(tasksToInsert);
      console.log(
        `Inserted ${tasksToInsert.length} tasks for rep ${taskList.repId}`
      );
    }
  } catch (error) {
    console.error(
      `Failed to update task table for rep ${taskList.repId}:`,
      error
    );
  }
}

// Store digest record for analytics
async function storeDigestRecord(taskLists: DailyTaskList[]): Promise<void> {
  try {
    const record = {
      date: new Date().toISOString(),
      total_reps: taskLists.length,
      total_tasks: taskLists.reduce((sum, t) => sum + t.totalTasks, 0),
      average_tasks_per_rep: Math.round(
        (taskLists.reduce((sum, t) => sum + t.totalTasks, 0) /
          taskLists.length) *
          100
      ) / 100,
      data: taskLists,
    };

    await supabase.from("daily_digest_records").insert(record);
  } catch (error) {
    console.error("Failed to store digest record:", error);
  }
}

// Main Trigger.dev task - runs daily at 7 PM
export const dailyDigestTask = task({
  id: "daily_digest",
  trigger: cronTrigger({
    cron: "0 19 * * *", // 7 PM daily (UTC)
  }),
  run: async () => {
    console.log("Starting daily digest generation");

    try {
      // 1. Fetch tomorrow's schedule from JDE
      const repSchedules = await fetchTomorrowsSchedule();

      // 2. Get all active reps
      const allReps = await getAllActiveReps();

      // 3. Build task lists and send notifications
      const taskLists: DailyTaskList[] = [];

      for (const rep of allReps) {
        const tasks = repSchedules.get(rep.id) || [];
        const taskList = buildDailyTaskList(rep.id, tasks);

        taskLists.push(taskList);

        // Send push notification if rep has tasks
        if (tasks.length > 0) {
          await sendTaskPreviewNotification(
            rep.id,
            tasks.length,
            taskList.estimatedHours,
            rep.pushToken
          );
        }

        // Send email digest
        await sendTaskDigestEmail(rep.email, rep.email, taskList);

        // 4. Update task table
        await updateTaskTable(taskList);
      }

      // 5. Store digest record for analytics
      await storeDigestRecord(taskLists);

      return {
        success: true,
        repsProcessed: allReps.length,
        totalTasks: taskLists.reduce((sum, t) => sum + t.totalTasks, 0),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Daily digest generation failed:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
