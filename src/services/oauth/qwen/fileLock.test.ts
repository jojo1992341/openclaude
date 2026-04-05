import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { FileLock } from "./fileLock";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-filelock-test");

describe("FileLock", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("acquires and releases lock", async () => {
    const lockPath = join(TEST_DIR, "test.lock");
    const lock = new FileLock(lockPath);
    await lock.acquire();
    expect(existsSync(lockPath)).toBe(true);
    lock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  test("wraps function with lock", async () => {
    const lockPath = join(TEST_DIR, "test.lock");
    const lock = new FileLock(lockPath);
    let executed = false;
    const result = await lock.withLock(async () => {
      executed = true;
      return 42;
    });
    expect(result).toBe(42);
    expect(executed).toBe(true);
  });

  test("releases lock on error", async () => {
    const lockPath = join(TEST_DIR, "test.lock");
    const lock = new FileLock(lockPath);
    await expect(
      lock.withLock(async () => {
        throw new Error("test error");
      })
    ).rejects.toThrow("test error");
    expect(existsSync(lockPath)).toBe(false);
  });

  test("detects stale lock and recovers", async () => {
    const lockPath = join(TEST_DIR, "stale.lock");
    writeFileSync(lockPath, JSON.stringify({ pid: 999999, timestamp: Date.now() - 15000 }));
    const lock = new FileLock(lockPath, { staleThreshold: 10000 });
    await lock.withLock(async () => {
      expect(existsSync(lockPath)).toBe(true);
    });
    lock.release();
  });
});
