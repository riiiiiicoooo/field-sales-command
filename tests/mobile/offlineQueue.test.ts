/**
 * Tests for offline queue management
 * Tests operation queueing, deduplication, network handling, and persistence
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { OfflineQueue } from "../../../mobile/app/services/offlineQueue";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage");

describe("OfflineQueue", () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    queue = new OfflineQueue();
  });

  describe("Adding operations to queue", () => {
    it("should add operation to queue", async () => {
      const operation = {
        id: "op-1",
        type: "visit_create",
        data: { customerId: "CUST001", revenue: 500 },
        timestamp: Date.now(),
      };

      await queue.add(operation);

      expect(queue.size()).toBe(1);
    });

    it("should maintain insertion order", async () => {
      const ops = [
        { id: "op-1", type: "visit_create", data: {} },
        { id: "op-2", type: "visit_create", data: {} },
        { id: "op-3", type: "visit_create", data: {} },
      ];

      for (const op of ops) {
        await queue.add(op);
      }

      expect(queue.size()).toBe(3);

      const first = queue.peek();
      expect(first?.id).toBe("op-1");
    });

    it("should handle rapid additions", async () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        return queue.add({
          id: `op-${i}`,
          type: "visit_create",
          data: {},
        });
      });

      await Promise.all(promises);
      expect(queue.size()).toBe(100);
    });
  });

  describe("Deduplication logic", () => {
    it("should detect duplicate operations by ID", async () => {
      const operation = {
        id: "op-1",
        type: "visit_create",
        data: { customerId: "CUST001" },
        timestamp: Date.now(),
      };

      await queue.add(operation);
      const beforeDuplicate = queue.size();

      await queue.add(operation);
      const afterDuplicate = queue.size();

      expect(beforeDuplicate).toBe(1);
      expect(afterDuplicate).toBe(1); // Should not add duplicate
    });

    it("should detect duplicate visits for same customer", async () => {
      const op1 = {
        id: "op-1",
        type: "visit_create",
        data: {
          customerId: "CUST001",
          timestamp: "2024-02-01T10:00:00Z",
        },
      };

      const op2 = {
        id: "op-2",
        type: "visit_create",
        data: {
          customerId: "CUST001",
          timestamp: "2024-02-01T10:00:00Z",
        },
      };

      await queue.add(op1);
      const isDuplicate = await queue.isDuplicate(op2);

      expect(isDuplicate).toBe(true);
    });

    it("should not mark different timestamps as duplicates", async () => {
      const op1 = {
        id: "op-1",
        type: "visit_create",
        data: {
          customerId: "CUST001",
          timestamp: "2024-02-01T10:00:00Z",
        },
      };

      const op2 = {
        id: "op-2",
        type: "visit_create",
        data: {
          customerId: "CUST001",
          timestamp: "2024-02-01T11:00:00Z",
        },
      };

      await queue.add(op1);
      const isDuplicate = await queue.isDuplicate(op2);

      expect(isDuplicate).toBe(false);
    });

    it("should handle deduplication with different operation types", async () => {
      const visitOp = {
        id: "op-1",
        type: "visit_create",
        data: { customerId: "CUST001" },
      };

      const updateOp = {
        id: "op-2",
        type: "customer_update",
        data: { customerId: "CUST001" },
      };

      await queue.add(visitOp);
      const isDuplicate = await queue.isDuplicate(updateOp);

      expect(isDuplicate).toBe(false); // Different operation types
    });
  });

  describe("processQueue with mock network", () => {
    it("should process queue items successfully", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockResolvedValue({ success: true });

      const operation = {
        id: "op-1",
        type: "visit_create",
        data: { customerId: "CUST001", revenue: 500 },
      };

      await queue.add(operation);

      const results = await queue.processQueue(mockNetworkCall);

      expect(mockNetworkCall).toHaveBeenCalledWith(operation);
      expect(results.successful).toBe(1);
      expect(results.failed).toBe(0);
    });

    it("should remove successfully processed items", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockResolvedValue({ success: true });

      await queue.add({
        id: "op-1",
        type: "visit_create",
        data: {},
      });

      await queue.processQueue(mockNetworkCall);

      expect(queue.size()).toBe(0);
    });

    it("should keep failed items in queue", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await queue.add({
        id: "op-1",
        type: "visit_create",
        data: {},
      });

      await queue.processQueue(mockNetworkCall);

      expect(queue.size()).toBe(1); // Item stays in queue
    });

    it("should process multiple items", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockResolvedValue({ success: true });

      for (let i = 0; i < 5; i++) {
        await queue.add({
          id: `op-${i}`,
          type: "visit_create",
          data: {},
        });
      }

      const results = await queue.processQueue(mockNetworkCall);

      expect(mockNetworkCall).toHaveBeenCalledTimes(5);
      expect(results.successful).toBe(5);
    });

    it("should handle partial failures", async () => {
      let callCount = 0;
      const mockNetworkCall = jest.fn(async () => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error("Network error");
        }
        return { success: true };
      });

      for (let i = 0; i < 4; i++) {
        await queue.add({
          id: `op-${i}`,
          type: "visit_create",
          data: {},
        });
      }

      const results = await queue.processQueue(mockNetworkCall);

      expect(results.successful).toBe(2);
      expect(results.failed).toBe(2);
      expect(queue.size()).toBe(2); // Failed items remain
    });
  });

  describe("Exponential backoff", () => {
    it("should retry failed operations with exponential backoff", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true });

      const operation = {
        id: "op-1",
        type: "visit_create",
        data: {},
        retryCount: 0,
      };

      await queue.add(operation);

      // First attempt fails
      await queue.processQueue(mockNetworkCall);
      expect(queue.size()).toBe(1);

      // Wait for backoff
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second attempt succeeds
      await queue.processQueue(mockNetworkCall);
      expect(queue.size()).toBe(0);
    });

    it("should increase backoff duration on each retry", async () => {
      const delays: number[] = [];

      const mockNetworkCall = jest.fn(async () => {
        throw new Error("Network error");
      });

      const operation = {
        id: "op-1",
        type: "visit_create",
        data: {},
        retryCount: 0,
      };

      await queue.add(operation);

      // Simulate multiple retry cycles
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await queue.processQueue(mockNetworkCall);
        const elapsed = Date.now() - start;

        if (i > 0) {
          delays.push(elapsed);
        }

        // Wait for backoff before next attempt
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Each delay should be >= previous (exponential backoff)
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
      }
    });

    it("should stop retrying after max attempts", async () => {
      const mockNetworkCall = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const operation = {
        id: "op-1",
        type: "visit_create",
        data: {},
        retryCount: 0,
        maxRetries: 3,
      };

      await queue.add(operation);

      // Try processing multiple times
      for (let i = 0; i < 5; i++) {
        await queue.processQueue(mockNetworkCall);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Should have given up after maxRetries
      expect(mockNetworkCall.mock.calls.length).toBeLessThanOrEqual(4); // Initial + 3 retries
    });
  });

  describe("Queue persistence", () => {
    it("should save queue to AsyncStorage", async () => {
      const operation = {
        id: "op-1",
        type: "visit_create",
        data: { customerId: "CUST001" },
      };

      await queue.add(operation);
      await queue.persist();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "offlineQueue",
        expect.stringContaining("op-1")
      );
    });

    it("should load queue from AsyncStorage on restart", async () => {
      const savedQueue = [
        {
          id: "op-1",
          type: "visit_create",
          data: { customerId: "CUST001" },
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(savedQueue)
      );

      const newQueue = new OfflineQueue();
      await newQueue.restore();

      expect(newQueue.size()).toBe(1);
      expect(newQueue.peek()?.id).toBe("op-1");
    });

    it("should persist across app restart", async () => {
      // Add items to queue
      for (let i = 0; i < 3; i++) {
        await queue.add({
          id: `op-${i}`,
          type: "visit_create",
          data: {},
        });
      }

      await queue.persist();

      // Simulate app restart - create new queue instance
      const restoredData = queue.getAll();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(restoredData)
      );

      const newQueue = new OfflineQueue();
      await newQueue.restore();

      expect(newQueue.size()).toBe(3);
    });

    it("should handle corrupted AsyncStorage gracefully", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        "invalid json {{"
      );

      const newQueue = new OfflineQueue();
      await expect(newQueue.restore()).resolves.not.toThrow();
      expect(newQueue.size()).toBe(0);
    });

    it("should clear persisted data on successful sync", async () => {
      await queue.add({
        id: "op-1",
        type: "visit_create",
        data: {},
      });

      const mockNetworkCall = jest
        .fn()
        .mockResolvedValue({ success: true });

      await queue.processQueue(mockNetworkCall);
      await queue.clear();

      expect(queue.size()).toBe(0);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith("offlineQueue");
    });
  });

  describe("Queue state management", () => {
    it("should report queue status correctly", async () => {
      expect(queue.isEmpty()).toBe(true);

      await queue.add({ id: "op-1", type: "visit_create", data: {} });

      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1);
    });

    it("should get all operations in order", async () => {
      const ops = [
        { id: "op-1", type: "visit_create", data: {} },
        { id: "op-2", type: "visit_create", data: {} },
        { id: "op-3", type: "visit_create", data: {} },
      ];

      for (const op of ops) {
        await queue.add(op);
      }

      const all = queue.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((o) => o.id)).toEqual(["op-1", "op-2", "op-3"]);
    });

    it("should peek without removing", async () => {
      await queue.add({ id: "op-1", type: "visit_create", data: {} });

      const peeked = queue.peek();
      expect(peeked?.id).toBe("op-1");
      expect(queue.size()).toBe(1); // Still there
    });

    it("should clear entire queue", async () => {
      for (let i = 0; i < 5; i++) {
        await queue.add({ id: `op-${i}`, type: "visit_create", data: {} });
      }

      expect(queue.size()).toBe(5);

      await queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });
});
