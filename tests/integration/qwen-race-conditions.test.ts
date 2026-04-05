import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { FileLock } from "../../src/services/oauth/qwen/fileLock";
import { saveCredentials, loadCredentials } from "../../src/services/oauth/qwen/credentials";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-race-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("Race Conditions", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("concurrent file locks execute sequentially", async () => {
    const lockPath = TEST_CREDS_PATH + ".lock";
    const lock1 = new FileLock(lockPath);
    const lock2 = new FileLock(lockPath);

    let inProgress = 0;
    let maxConcurrent = 0;

    const task1 = lock1.withLock(async () => {
      inProgress++;
      maxConcurrent = Math.max(maxConcurrent, inProgress);
      await new Promise((r) => setTimeout(r, 50));
      inProgress--;
      return "refreshed-1";
    });

    const task2 = lock2.withLock(async () => {
      inProgress++;
      maxConcurrent = Math.max(maxConcurrent, inProgress);
      return "refreshed-2";
    });

    const [r1, r2] = await Promise.all([task1, task2]);
    expect(r1).toBe("refreshed-1");
    expect(r2).toBe("refreshed-2");
    expect(maxConcurrent).toBe(1); // Sequential, not concurrent
  });

  test("corrupted credentials file returns null", async () => {
    writeFileSync(TEST_CREDS_PATH, "{ invalid json", "utf-8");
    const loaded = await loadCredentials();
    expect(loaded).toBeNull();
  });

  test("empty credentials file returns null", async () => {
    writeFileSync(TEST_CREDS_PATH, "", "utf-8");
    const loaded = await loadCredentials();
    expect(loaded).toBeNull();
  });
});
