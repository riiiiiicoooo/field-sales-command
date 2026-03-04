import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import Redis from "ioredis";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const redis = new Redis(process.env.REDIS_URL!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Type definitions
interface JDECustomerData {
  customerId: string;
  accountBalance: number;
  recentOrders: Array<{
    orderNumber: string;
    date: string;
    amount: number;
  }>;
  creditLimit: number;
}

interface SalesforceOpportunity {
  id: string;
  name: string;
  stage: string;
  amount: number;
  closeDate: string;
}

interface SnowflakeMetrics {
  ltv: number;
  churnProbability: number;
  purchaseFrequency: number;
  averageOrderValue: number;
  lastPurchaseDate: string;
}

interface AggregatedCustomerProfile {
  customerId: string;
  name: string;
  accountBalance: number;
  creditLimit: number;
  ltv: number;
  churnProbability: number;
  recentOrders: JDECustomerData["recentOrders"];
  openOpportunities: SalesforceOpportunity[];
  metrics: SnowflakeMetrics;
  lastUpdated: string;
  aggregatedAt: string;
}

// Schema for Trigger.dev
const inputSchema = z.object({
  customerId: z.string(),
  repId: z.string(),
  division: z.string(),
});

// Fetch from JDE (Oracle ERP)
async function fetchJDEData(customerId: string): Promise<JDECustomerData> {
  try {
    const response = await axios.get(
      `${process.env.JDE_API_URL}/customers/${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.JDE_API_KEY}`,
        },
        timeout: 5000,
      }
    );
    return response.data;
  } catch (error) {
    console.error(`JDE fetch failed for customer ${customerId}:`, error);
    // Return cached or default data on failure
    return {
      customerId,
      accountBalance: 0,
      recentOrders: [],
      creditLimit: 0,
    };
  }
}

// Fetch from Salesforce
async function fetchSalesforceData(
  customerId: string
): Promise<SalesforceOpportunity[]> {
  try {
    const response = await axios.get(
      `${process.env.SALESFORCE_API_URL}/opportunities`,
      {
        params: {
          accountId: customerId,
          stages: ["Prospecting", "Qualification", "Proposal"],
        },
        headers: {
          Authorization: `Bearer ${process.env.SALESFORCE_API_KEY}`,
        },
        timeout: 5000,
      }
    );
    return response.data.records || [];
  } catch (error) {
    console.error(
      `Salesforce fetch failed for customer ${customerId}:`,
      error
    );
    return [];
  }
}

// Fetch from Snowflake (via analytics API)
async function fetchSnowflakeMetrics(
  customerId: string
): Promise<SnowflakeMetrics> {
  try {
    const response = await axios.post(
      `${process.env.SNOWFLAKE_API_URL}/metrics`,
      {
        customerId,
        metrics: ["ltv", "churn_probability", "purchase_frequency"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SNOWFLAKE_API_KEY}`,
        },
        timeout: 5000,
      }
    );

    const data = response.data;
    return {
      ltv: data.ltv || 0,
      churnProbability: data.churn_probability || 0,
      purchaseFrequency: data.purchase_frequency || 0,
      averageOrderValue: data.aov || 0,
      lastPurchaseDate: data.last_purchase_date || new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `Snowflake fetch failed for customer ${customerId}:`,
      error
    );
    return {
      ltv: 0,
      churnProbability: 0,
      purchaseFrequency: 0,
      averageOrderValue: 0,
      lastPurchaseDate: new Date().toISOString(),
    };
  }
}

// Aggregate all data sources
async function aggregateCustomerProfile(
  customerId: string
): Promise<AggregatedCustomerProfile> {
  const [jdeData, sfData, snowflakeData] = await Promise.all([
    fetchJDEData(customerId),
    fetchSalesforceData(customerId),
    fetchSnowflakeMetrics(customerId),
  ]);

  // Get customer name from any source
  let customerName = customerId;
  try {
    const { data: customerRecord } = await supabase
      .from("customers")
      .select("name")
      .eq("external_id", customerId)
      .single();
    if (customerRecord) customerName = customerRecord.name;
  } catch (error) {
    console.error("Failed to fetch customer name from Supabase:", error);
  }

  return {
    customerId,
    name: customerName,
    accountBalance: jdeData.accountBalance,
    creditLimit: jdeData.creditLimit,
    ltv: snowflakeData.ltv,
    churnProbability: snowflakeData.churnProbability,
    recentOrders: jdeData.recentOrders,
    openOpportunities: sfData,
    metrics: snowflakeData,
    lastUpdated: new Date().toISOString(),
    aggregatedAt: new Date().toISOString(),
  };
}

// Cache in Redis with 1 hour TTL
async function cacheProfile(
  customerId: string,
  profile: AggregatedCustomerProfile
): Promise<void> {
  const cacheKey = `customer:profile:${customerId}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(profile));
}

// Get from cache
async function getCachedProfile(
  customerId: string
): Promise<AggregatedCustomerProfile | null> {
  const cacheKey = `customer:profile:${customerId}`;
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

// Publish realtime update to mobile via Supabase
async function publishRealtimeUpdate(
  repId: string,
  division: string,
  profile: AggregatedCustomerProfile
): Promise<void> {
  try {
    // Publish to rep's channel
    await supabase.realtime.emit({
      event: "customer_profile_updated",
      schema: "realtime",
      table: "customer_profiles",
      commit_timestamp: new Date().toISOString(),
      eventType: "UPDATE",
      new: profile,
      old: null,
    });

    console.log(
      `Published customer profile update for ${profile.customerId} to rep ${repId}`
    );
  } catch (error) {
    console.error("Failed to publish realtime update:", error);
  }
}

// Main Trigger.dev task
export const customerAggregationTask = task({
  id: "customer_aggregation",
  run: async (payload) => {
    const input = inputSchema.parse(payload);
    const { customerId, repId, division } = input;

    console.log(
      `Starting customer aggregation for ${customerId} by rep ${repId}`
    );

    // Check cache first
    let profile = await getCachedProfile(customerId);

    if (!profile) {
      // Fetch from all sources and aggregate
      profile = await aggregateCustomerProfile(customerId);

      // Cache result
      await cacheProfile(customerId, profile);
    } else {
      console.log(`Using cached profile for customer ${customerId}`);
    }

    // Publish realtime update to mobile
    await publishRealtimeUpdate(repId, division, profile);

    // Store aggregation event in database for audit trail
    try {
      await supabase.from("customer_aggregation_events").insert({
        customer_id: customerId,
        rep_id: repId,
        division,
        profile_data: profile,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to store aggregation event:", error);
    }

    return {
      success: true,
      customerId,
      profile,
      cachedFromRedis: !!profile,
    };
  },
});

// HTTP endpoint to trigger the job
import { serve } from "@trigger.dev/sdk/v3";

serve(async (request) => {
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const result = await customerAggregationTask.trigger(body);
      return new Response(JSON.stringify(result), { status: 200 });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        { status: 400 }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
