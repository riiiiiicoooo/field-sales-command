import { task, eventTrigger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Type definitions
interface VisitData {
  visitId: string;
  customerId: string;
  repId: string;
  division: string;
  startTime: string;
  endTime: string;
  tasksCompleted: string[];
  revenue: number;
  notes: string;
  latitude: number;
  longitude: number;
}

interface UpsellOpportunity {
  customerId: string;
  repId: string;
  opportunityType: string;
  score: number;
  suggestedProducts: string[];
}

// Schema validation
const visitDataSchema = z.object({
  visitId: z.string(),
  customerId: z.string(),
  repId: z.string(),
  division: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  tasksCompleted: z.array(z.string()),
  revenue: z.number(),
  notes: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

// Update customer last visit date
async function updateLastVisitDate(
  customerId: string,
  visitDate: string
): Promise<void> {
  try {
    await supabase
      .from("customers")
      .update({ last_visit_date: visitDate })
      .eq("external_id", customerId);
  } catch (error) {
    console.error(`Failed to update last_visit_date for ${customerId}:`, error);
  }
}

// Increment rep visit counters
async function incrementRepCounters(
  repId: string,
  revenue: number,
  taskCount: number
): Promise<void> {
  try {
    // Get current counters
    const { data: repData } = await supabase
      .from("reps")
      .select("visits_this_week, visits_this_month, revenue_this_week, revenue_this_month, tasks_completed_this_week")
      .eq("id", repId)
      .single();

    if (!repData) {
      console.error(`Rep ${repId} not found`);
      return;
    }

    // Update with increments
    await supabase
      .from("reps")
      .update({
        visits_this_week: (repData.visits_this_week || 0) + 1,
        visits_this_month: (repData.visits_this_month || 0) + 1,
        revenue_this_week: (repData.revenue_this_week || 0) + revenue,
        revenue_this_month: (repData.revenue_this_month || 0) + revenue,
        tasks_completed_this_week:
          (repData.tasks_completed_this_week || 0) + taskCount,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", repId);

    console.log(`Updated counters for rep ${repId}`);
  } catch (error) {
    console.error(`Failed to increment rep counters for ${repId}:`, error);
  }
}

// Check for upsell opportunities (high LTV + no recent opportunity)
async function checkUpsellTriggers(
  customerId: string,
  repId: string
): Promise<UpsellOpportunity | null> {
  try {
    // Fetch customer LTV and last opportunity
    const { data: customerData } = await supabase
      .from("customers")
      .select("ltv, last_opportunity_date")
      .eq("external_id", customerId)
      .single();

    if (!customerData) return null;

    const ltv = customerData.ltv || 0;
    const lastOpportDate = customerData.last_opportunity_date
      ? new Date(customerData.last_opportunity_date)
      : null;
    const daysAgo = lastOpportDate
      ? Math.floor(
          (Date.now() - lastOpportDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : Infinity;

    // Trigger upsell if LTV > $10k and no opportunity in last 30 days
    if (ltv > 10000 && daysAgo > 30) {
      return {
        customerId,
        repId,
        opportunityType: "upsell_high_value",
        score: Math.min(ltv / 50000, 1), // Normalize score 0-1
        suggestedProducts: ["Premium Service Package", "Extended Warranty"],
      };
    }

    return null;
  } catch (error) {
    console.error(`Failed to check upsell triggers for ${customerId}:`, error);
    return null;
  }
}

// Send visit confirmation email
async function sendVisitConfirmationEmail(visit: VisitData): Promise<void> {
  try {
    const durationMinutes = Math.floor(
      (new Date(visit.endTime).getTime() - new Date(visit.startTime).getTime()) /
        60000
    );

    const response = await axios.post(
      `${process.env.API_URL}/emails/visit-confirmation`,
      {
        repId: visit.repId,
        customerId: visit.customerId,
        customerName: null, // Will be fetched by the email service
        visitDuration: durationMinutes,
        tasksCompleted: visit.tasksCompleted.length,
        revenue: visit.revenue,
        notes: visit.notes,
        visitDate: new Date(visit.endTime).toISOString().split("T")[0],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
      }
    );

    console.log(
      `Visit confirmation email sent for visit ${visit.visitId}`,
      response.status
    );
  } catch (error) {
    console.error(
      `Failed to send visit confirmation email for ${visit.visitId}:`,
      error
    );
  }
}

// Queue leaderboard recalculation
async function queueLeaderboardRecalc(division: string): Promise<void> {
  try {
    // Store in a queue table or Redis
    const { error } = await supabase.from("leaderboard_update_queue").insert({
      division,
      triggered_at: new Date().toISOString(),
      processed: false,
    });

    if (error) {
      console.error(
        `Failed to queue leaderboard recalc for ${division}:`,
        error
      );
      return;
    }

    // Alternatively, trigger the leaderboard job directly
    await axios.post(
      `${process.env.TRIGGER_ENDPOINT}/leaderboard_publish`,
      { division },
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIGGER_API_KEY}`,
        },
      }
    );

    console.log(`Leaderboard recalc queued for division ${division}`);
  } catch (error) {
    console.error(`Failed to queue leaderboard recalc:`, error);
  }
}

// Store visit completion event
async function storeVisitEvent(visit: VisitData): Promise<void> {
  try {
    await supabase.from("visit_events").insert({
      visit_id: visit.visitId,
      customer_id: visit.customerId,
      rep_id: visit.repId,
      division,
      start_time: visit.startTime,
      end_time: visit.endTime,
      duration_minutes: Math.floor(
        (new Date(visit.endTime).getTime() - new Date(visit.startTime).getTime()) /
          60000
      ),
      tasks_completed: visit.tasksCompleted.length,
      revenue: visit.revenue,
      notes: visit.notes,
      latitude: visit.latitude,
      longitude: visit.longitude,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to store visit event for ${visit.visitId}:`, error);
  }
}

// Main Trigger.dev task
export const visitCompletionTask = task({
  id: "visit_completion",
  trigger: eventTrigger({
    name: "visit.completed",
  }),
  run: async (payload) => {
    const visit = visitDataSchema.parse(payload);

    console.log(`Processing visit completion: ${visit.visitId}`);

    // 1. Update customer last_visit_date
    await updateLastVisitDate(visit.customerId, visit.endTime);

    // 2. Increment rep visit counters
    await incrementRepCounters(visit.repId, visit.revenue, visit.tasksCompleted.length);

    // 3. Check for upsell triggers
    const upsellOpportunity = await checkUpsellTriggers(
      visit.customerId,
      visit.repId
    );

    if (upsellOpportunity) {
      console.log(
        `Upsell opportunity detected for customer ${visit.customerId}`,
        upsellOpportunity
      );

      // Store upsell opportunity in database
      try {
        await supabase.from("upsell_opportunities").insert({
          customer_id: visit.customerId,
          rep_id: visit.repId,
          opportunity_type: upsellOpportunity.opportunityType,
          score: upsellOpportunity.score,
          suggested_products: upsellOpportunity.suggestedProducts,
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to store upsell opportunity:", error);
      }
    }

    // 4. Send visit confirmation email
    await sendVisitConfirmationEmail(visit);

    // 5. Store visit event for analytics
    await storeVisitEvent(visit);

    // 6. Queue leaderboard recalculation
    await queueLeaderboardRecalc(visit.division);

    return {
      success: true,
      visitId: visit.visitId,
      upsellTriggered: !!upsellOpportunity,
      emailSent: true,
      leaderboardQueued: true,
    };
  },
});
