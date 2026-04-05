import { describe, test, expect } from "bun:test";
import { retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  test("returns result on first success", async () => {
    expect(await retryWithBackoff(async () => 42)).toBe(42);
  });

  test("retries then succeeds", async () => {
    let attempts = 0;
    const result = await retryWithBackoff(async () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "success";
    }, { maxRetries: 5, initialDelayMS: 10 });
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  test("throws after max retries", async () => {
    await expect(
      retryWithBackoff(async () => { throw new Error("nope"); }, { maxRetries: 3, initialDelayMS: 10 })
    ).rejects.toThrow("nope");
  });

  test("respects shouldRetry predicate", async () => {
    let attempts = 0;
    await expect(
      retryWithBackoff(
        async () => { attempts++; throw new Error("nope"); },
        { maxRetries: 10, initialDelayMS: 10, shouldRetry: () => false }
      )
    ).rejects.toThrow("nope");
    expect(attempts).toBe(1);
  });

  test("adds jitter to delay", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: any, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(fn, 0);
    }) as any;

    await retryWithBackoff(
      async () => { throw new Error("fail"); },
      { maxRetries: 3, initialDelayMS: 100 }
    ).catch(() => {});

    globalThis.setTimeout = originalSetTimeout;
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});
