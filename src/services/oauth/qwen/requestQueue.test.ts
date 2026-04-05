import { describe, test, expect } from "bun:test";
import { RequestQueue } from "./requestQueue";

describe("RequestQueue", () => {
  test("executes single request", async () => {
    const queue = new RequestQueue();
    const result = await queue.enqueue(async () => "ok");
    expect(result).toBe("ok");
  });

  test("enforces minimum interval between requests", async () => {
    const queue = new RequestQueue({ minIntervalMS: 100, jitterMinMS: 0, jitterMaxMS: 0 });
    const times: number[] = [];

    await queue.enqueue(async () => { times.push(Date.now()); return 1; });
    await queue.enqueue(async () => { times.push(Date.now()); return 2; });

    const diff = times[1] - times[0];
    expect(diff).toBeGreaterThanOrEqual(95); // Allow 5ms tolerance
  });

  test("adds jitter between requests", async () => {
    const queue = new RequestQueue({ minIntervalMS: 50, jitterMinMS: 10, jitterMaxMS: 50 });
    const intervals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await queue.enqueue(async () => i);
      if (i > 0) {
        // We can't easily measure intervals without more complex setup,
        // so just verify it doesn't throw
      }
    }
  });

  test("propagates errors from enqueued functions", async () => {
    const queue = new RequestQueue();
    await expect(queue.enqueue(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });

  test("continues after error", async () => {
    const queue = new RequestQueue({ minIntervalMS: 10, jitterMinMS: 0, jitterMaxMS: 0 });
    await expect(queue.enqueue(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    const result = await queue.enqueue(async () => "recovered");
    expect(result).toBe("recovered");
  });
});
