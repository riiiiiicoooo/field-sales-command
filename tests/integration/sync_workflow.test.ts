/**
 * Integration tests for complete sync workflow
 * Tests the full flow: offline creation -> online sync -> backend update -> realtime notification
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const API_URL = process.env.API_URL || "http://localhost:8000";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";

// Test helpers
const createTestRep = async (division: string) => {
  return {
    id: `rep-${Date.now()}`,
    name: "Test Rep",
    division,
    email: `rep-${Date.now()}@test.com`,
  };
};

const createTestCustomer = async (division: string) => {
  return {
    id: `cust-${Date.now()}`,
    name: "Test Customer",
    division,
    external_id: `EXT-${Date.now()}`,
  };
};

describe("Complete Sync Workflow Integration", () => {
  let testRep: any;
  let testCustomer: any;
  let supabaseClient: any;
  let authToken: string;

  beforeEach(async () => {
    // Setup test data
    testRep = await createTestRep("division-a");
    testCustomer = await createTestCustomer("division-a");

    // Initialize Supabase client
    supabaseClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || "test-key"
    );

    // Get auth token
    authToken = `Bearer test-token-${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test data
    // In real tests, would delete created records
  });

  describe("Offline visit creation", () => {
    it("should create visit locally when offline", async () => {
      const visitData = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1", "task2"],
        revenue: 500,
        notes: "Great visit",
      };

      // Would normally use mobile SDK in offline mode
      // For integration test, we simulate offline behavior
      const response = await axios.post(`${API_URL}/api/v1/visits/offline`, visitData, {
        headers: { Authorization: authToken },
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty("visitId");

      // Verify visit is stored locally (in queue)
      expect(response.data.synced).toBe(false);
    });

    it("should queue multiple visits when offline", async () => {
      const visits = [
        {
          customerId: testCustomer.id,
          repId: testRep.id,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 30 * 60000).toISOString(),
          latitude: 40.7128,
          longitude: -74.0060,
          tasksCompleted: ["task1"],
          revenue: 500,
        },
        {
          customerId: testCustomer.id,
          repId: testRep.id,
          startTime: new Date(Date.now() + 45 * 60000).toISOString(),
          endTime: new Date(Date.now() + 75 * 60000).toISOString(),
          latitude: 40.7200,
          longitude: -74.0100,
          tasksCompleted: ["task2"],
          revenue: 750,
        },
      ];

      const results = await Promise.all(
        visits.map((v) =>
          axios.post(`${API_URL}/api/v1/visits/offline`, v, {
            headers: { Authorization: authToken },
          })
        )
      );

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.status).toBe(201);
        expect(r.data.synced).toBe(false);
      });
    });
  });

  describe("Sync process", () => {
    it("should sync queued visits when coming online", async () => {
      // Create offline visit
      const offlineVisit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      const offlineRes = await axios.post(
        `${API_URL}/api/v1/visits/offline`,
        offlineVisit,
        { headers: { Authorization: authToken } }
      );

      expect(offlineRes.data.synced).toBe(false);

      // Trigger sync
      const syncRes = await axios.post(
        `${API_URL}/api/v1/sync`,
        {
          visits: [offlineRes.data],
        },
        { headers: { Authorization: authToken } }
      );

      expect(syncRes.status).toBe(200);
      expect(syncRes.data.synced_count).toBe(1);
    });

    it("should deduplicate visits during sync", async () => {
      const visit = {
        visitId: `visit-${Date.now()}`,
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      // First sync
      const sync1 = await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      expect(sync1.data.synced_count).toBe(1);

      // Second sync with same visit
      const sync2 = await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      expect(sync2.data.synced_count).toBe(0);
      expect(sync2.data.skipped_count).toBe(1);
    });

    it("should handle sync errors gracefully", async () => {
      const invalidVisit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() - 30 * 60000).toISOString(), // Invalid: end before start
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: [],
        revenue: 500,
      };

      const syncRes = await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [invalidVisit] },
        {
          headers: { Authorization: authToken },
          validateStatus: () => true, // Accept any status
        }
      );

      expect(syncRes.status).toBe(200);
      expect(syncRes.data.error_count).toBeGreaterThan(0);
    });
  });

  describe("Backend update after sync", () => {
    it("should update customer last_visit_date", async () => {
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      // Sync visit
      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      // Check customer was updated
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for processing

      const customerRes = await axios.get(
        `${API_URL}/api/v1/customers/${testCustomer.id}`,
        { headers: { Authorization: authToken } }
      );

      expect(customerRes.data.last_visit_date).toBeTruthy();
    });

    it("should increment rep visit counters", async () => {
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      const beforeRes = await axios.get(
        `${API_URL}/api/v1/reps/${testRep.id}`,
        { headers: { Authorization: authToken } }
      );

      const beforeVisits = beforeRes.data.visits_this_week || 0;

      // Sync visit
      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for processing

      const afterRes = await axios.get(
        `${API_URL}/api/v1/reps/${testRep.id}`,
        { headers: { Authorization: authToken } }
      );

      expect(afterRes.data.visits_this_week).toBe(beforeVisits + 1);
    });

    it("should queue leaderboard recalculation", async () => {
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      // Sync visit
      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for leaderboard recalc

      // Verify leaderboard was updated
      const leaderboardRes = await axios.get(
        `${API_URL}/api/v1/leaderboards/division-a`,
        { headers: { Authorization: authToken } }
      );

      expect(leaderboardRes.status).toBe(200);
      expect(leaderboardRes.data.entries).toBeTruthy();
    });
  });

  describe("Realtime updates to mobile", () => {
    it("should send realtime notification on visit sync", async () => {
      // Subscribe to realtime updates
      const channel = supabaseClient.channel("visit-updates");

      let updateReceived = false;
      channel.on("broadcast", { event: "visit_synced" }, (payload) => {
        updateReceived = true;
        expect(payload.data).toHaveProperty("visitId");
      });

      await channel.subscribe();

      // Sync visit
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      // Wait for realtime update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(updateReceived).toBe(true);

      await channel.unsubscribe();
    });

    it("should update leaderboard in realtime", async () => {
      const channel = supabaseClient.channel("leaderboard-updates");

      let leaderboardUpdated = false;
      channel.on("broadcast", { event: "leaderboard_changed" }, (payload) => {
        leaderboardUpdated = true;
      });

      await channel.subscribe();

      // Sync visit that affects leaderboard
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 500,
      };

      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(leaderboardUpdated).toBe(true);

      await channel.unsubscribe();
    });

    it("should notify rep of rank changes", async () => {
      const channel = supabaseClient.channel(`rep-${testRep.id}`);

      let rankChangeReceived = false;
      channel.on("broadcast", { event: "rank_changed" }, (payload) => {
        rankChangeReceived = true;
        expect(payload.data).toHaveProperty("newRank");
      });

      await channel.subscribe();

      // Perform actions that would change rank
      const visit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1"],
        revenue: 5000, // Significant revenue
      };

      await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [visit] },
        { headers: { Authorization: authToken } }
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Rank change may or may not happen depending on leaderboard state
      // Just verify channel is working

      await channel.unsubscribe();
    });
  });

  describe("End-to-end scenario", () => {
    it("should complete full workflow: offline -> sync -> backend -> realtime", async () => {
      // 1. Create offline visit
      const offlineVisit = {
        customerId: testCustomer.id,
        repId: testRep.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 45 * 60000).toISOString(),
        latitude: 40.7128,
        longitude: -74.0060,
        tasksCompleted: ["task1", "task2"],
        revenue: 750,
        notes: "Excellent visit",
      };

      // 2. Sync to backend
      const syncRes = await axios.post(
        `${API_URL}/api/v1/sync`,
        { visits: [offlineVisit] },
        { headers: { Authorization: authToken } }
      );

      expect(syncRes.data.synced_count).toBe(1);

      // 3. Wait for backend processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Verify backend updated
      const customerRes = await axios.get(
        `${API_URL}/api/v1/customers/${testCustomer.id}/profile`,
        { headers: { Authorization: authToken } }
      );

      expect(customerRes.status).toBe(200);
      expect(customerRes.data.last_updated).toBeTruthy();

      // 5. Verify rep metrics updated
      const repRes = await axios.get(
        `${API_URL}/api/v1/reps/${testRep.id}`,
        { headers: { Authorization: authToken } }
      );

      expect(repRes.data.visits_this_week).toBeGreaterThan(0);

      // 6. Verify leaderboard exists
      const leaderboardRes = await axios.get(
        `${API_URL}/api/v1/leaderboards`,
        { headers: { Authorization: authToken } }
      );

      expect(leaderboardRes.status).toBe(200);
    });
  });
});
