import { task, cronTrigger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import axios from "axios";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Type definitions
interface RepMetrics {
  repId: string;
  name: string;
  visits: number;
  revenue: number;
  conversionRate: number;
}

interface LeaderboardEntry {
  rank: number;
  repId: string;
  name: string;
  division: string;
  visits: number;
  revenue: number;
  conversionRate: number;
  rankChange: number; // -1, 0, 1 indicating if rank improved, stayed same, or worsened
}

interface LeaderboardSnapshot {
  division: string;
  period: string; // week, month, quarter
  generatedAt: string;
  entries: LeaderboardEntry[];
}

// Calculate rankings by division and metric
async function calculateLeaderboards(): Promise<
  Map<string, Map<string, LeaderboardEntry[]>>
> {
  const leaderboards = new Map<string, Map<string, LeaderboardEntry[]>>();

  try {
    // Get all divisions
    const { data: divisions } = await supabase
      .from("divisions")
      .select("id, name");

    if (!divisions) {
      console.error("No divisions found");
      return leaderboards;
    }

    for (const division of divisions) {
      const divisionLeaderboards = new Map<string, LeaderboardEntry[]>();

      // Get reps in division with their metrics
      const { data: reps } = await supabase
        .from("reps")
        .select(
          `id, name, visits_this_week, visits_this_month, revenue_this_week,
           revenue_this_month, tasks_completed_this_week, customer_interactions_this_month`
        )
        .eq("division_id", division.id);

      if (!reps || reps.length === 0) {
        console.log(`No reps found for division ${division.id}`);
        continue;
      }

      // Calculate conversion rates
      const repsWithConversion = reps.map((rep) => ({
        ...rep,
        conversionRateWeek: rep.customer_interactions_this_month > 0
          ? rep.tasks_completed_this_week / rep.customer_interactions_this_month
          : 0,
        conversionRateMonth: rep.customer_interactions_this_month > 0
          ? rep.tasks_completed_this_week / rep.customer_interactions_this_month
          : 0,
      }));

      // Weekly leaderboard - rank by visits
      const weeklyByVisits = repsWithConversion
        .sort((a, b) => b.visits_this_week - a.visits_this_week)
        .map((rep, index) => ({
          rank: index + 1,
          repId: rep.id,
          name: rep.name,
          division: division.name,
          visits: rep.visits_this_week,
          revenue: rep.revenue_this_week,
          conversionRate: rep.conversionRateWeek,
          rankChange: 0, // Will be calculated after fetching old rankings
        }));

      divisionLeaderboards.set("weekly_visits", weeklyByVisits);

      // Weekly leaderboard - rank by revenue
      const weeklyByRevenue = repsWithConversion
        .sort((a, b) => b.revenue_this_week - a.revenue_this_week)
        .map((rep, index) => ({
          rank: index + 1,
          repId: rep.id,
          name: rep.name,
          division: division.name,
          visits: rep.visits_this_week,
          revenue: rep.revenue_this_week,
          conversionRate: rep.conversionRateWeek,
          rankChange: 0,
        }));

      divisionLeaderboards.set("weekly_revenue", weeklyByRevenue);

      // Monthly leaderboard - rank by conversion rate
      const monthlyByConversion = repsWithConversion
        .sort((a, b) => b.conversionRateMonth - a.conversionRateMonth)
        .map((rep, index) => ({
          rank: index + 1,
          repId: rep.id,
          name: rep.name,
          division: division.name,
          visits: rep.visits_this_month,
          revenue: rep.revenue_this_month,
          conversionRate: rep.conversionRateMonth,
          rankChange: 0,
        }));

      divisionLeaderboards.set("monthly_conversion", monthlyByConversion);

      leaderboards.set(division.id, divisionLeaderboards);
    }

    return leaderboards;
  } catch (error) {
    console.error("Failed to calculate leaderboards:", error);
    return leaderboards;
  }
}

// Detect rank changes and identify affected reps
async function detectRankChanges(
  division: string,
  leaderboard: LeaderboardEntry[]
): Promise<Map<string, number>> {
  const rankChanges = new Map<string, number>();

  try {
    const cacheKey = `leaderboard:${division}:current`;
    const oldLeaderboard = await redis.get(cacheKey);

    if (!oldLeaderboard) {
      console.log(`No previous leaderboard found for ${division}`);
      return rankChanges;
    }

    const oldEntries: LeaderboardEntry[] = JSON.parse(oldLeaderboard);
    const oldRanks = new Map(oldEntries.map((e) => [e.repId, e.rank]));

    for (const entry of leaderboard) {
      const oldRank = oldRanks.get(entry.repId);
      if (oldRank && oldRank !== entry.rank) {
        const change = oldRank - entry.rank; // Positive = rank improved
        rankChanges.set(entry.repId, change);
        entry.rankChange = change;
      }
    }

    return rankChanges;
  } catch (error) {
    console.error("Failed to detect rank changes:", error);
    return rankChanges;
  }
}

// Send push notification to affected reps
async function sendRankChangeNotification(
  repId: string,
  name: string,
  rankChange: number,
  newRank: number
): Promise<void> {
  try {
    // Get rep's push token
    const { data: repData } = await supabase
      .from("reps")
      .select("push_token, device_platform")
      .eq("id", repId)
      .single();

    if (!repData || !repData.push_token) {
      console.log(`No push token for rep ${repId}`);
      return;
    }

    const message =
      rankChange > 0
        ? `Great job! You moved up to rank #${newRank} on the leaderboard.`
        : `You moved down to rank #${newRank}. Time to push harder!`;

    // Send via push notification service (Firebase, OneSignal, etc.)
    await axios.post(`${process.env.PUSH_SERVICE_URL}/send`, {
      token: repData.push_token,
      title: "Leaderboard Update",
      message,
      data: {
        type: "leaderboard_change",
        newRank,
        rankChange,
      },
    });

    console.log(`Sent rank change notification to rep ${repId}`);
  } catch (error) {
    console.error(`Failed to send notification to rep ${repId}:`, error);
  }
}

// Write to database
async function writeToDatabase(
  division: string,
  leaderboards: Map<string, LeaderboardEntry[]>
): Promise<void> {
  try {
    for (const [metric, entries] of leaderboards) {
      for (const entry of entries) {
        await supabase.from("leaderboards").upsert({
          division_id: division,
          rep_id: entry.repId,
          metric,
          rank: entry.rank,
          visits: entry.visits,
          revenue: entry.revenue,
          conversion_rate: entry.conversionRate,
          calculated_at: new Date().toISOString(),
        });
      }
    }

    console.log(`Wrote leaderboards to database for division ${division}`);
  } catch (error) {
    console.error(
      `Failed to write leaderboards to database for ${division}:`,
      error
    );
  }
}

// Cache in Redis
async function cacheLeaderboards(
  division: string,
  leaderboards: Map<string, LeaderboardEntry[]>
): Promise<void> {
  try {
    for (const [metric, entries] of leaderboards) {
      const cacheKey = `leaderboard:${division}:${metric}`;
      await redis.setex(cacheKey, 86400, JSON.stringify(entries)); // 24 hour TTL
    }

    console.log(`Cached leaderboards for division ${division}`);
  } catch (error) {
    console.error(`Failed to cache leaderboards for ${division}:`, error);
  }
}

// Publish via Supabase Realtime
async function publishRealtimeUpdate(
  division: string,
  leaderboards: Map<string, LeaderboardEntry[]>
): Promise<void> {
  try {
    for (const [metric, entries] of leaderboards) {
      // Publish to a specific channel
      const channel = supabase.channel(
        `leaderboard:${division}:${metric}`,
        { config: { broadcast: { self: true } } }
      );

      channel.on("broadcast", { event: "update" }, (payload) => {
        console.log("Realtime leaderboard update received:", payload);
      });

      channel.subscribe();

      // Send the update
      await channel.send({
        type: "broadcast",
        event: "update",
        payload: {
          division,
          metric,
          entries,
          publishedAt: new Date().toISOString(),
        },
      });

      console.log(
        `Published ${metric} leaderboard for division ${division} via Realtime`
      );
    }
  } catch (error) {
    console.error("Failed to publish realtime update:", error);
  }
}

// Main Trigger.dev task - runs hourly
export const leaderboardPublishTask = task({
  id: "leaderboard_publish",
  trigger: cronTrigger({
    cron: "0 * * * *", // Every hour
  }),
  run: async () => {
    console.log("Starting leaderboard calculation and publication");

    try {
      // 1. Calculate rankings per division
      const allLeaderboards = await calculateLeaderboards();

      // 2. For each division, detect changes and send notifications
      for (const [division, leaderboards] of allLeaderboards) {
        console.log(`Processing division ${division}`);

        for (const [metric, entries] of leaderboards) {
          // Detect rank changes
          const rankChanges = await detectRankChanges(division, entries);

          // Send notifications for significant changes (rank change > 1)
          for (const [repId, rankChange] of rankChanges) {
            if (Math.abs(rankChange) >= 1) {
              const entry = entries.find((e) => e.repId === repId);
              if (entry) {
                await sendRankChangeNotification(
                  repId,
                  entry.name,
                  rankChange,
                  entry.rank
                );
              }
            }
          }

          // 3. Write to leaderboard table
          await writeToDatabase(division, new Map([[metric, entries]]));

          // 4. Cache in Redis
          await cacheLeaderboards(division, new Map([[metric, entries]]));

          // 5. Publish via Supabase Realtime
          await publishRealtimeUpdate(
            division,
            new Map([[metric, entries]])
          );
        }
      }

      return {
        success: true,
        divisionsProcessed: allLeaderboards.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Leaderboard calculation failed:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
