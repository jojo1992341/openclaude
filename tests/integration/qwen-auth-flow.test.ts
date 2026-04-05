import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { saveCredentials, loadCredentials, QwenCredentials } from "../../src/services/oauth/qwen/credentials";
import { TokenManager } from "../../src/services/oauth/qwen/tokenManager";
import { RequestQueue } from "../../src/services/oauth/qwen/requestQueue";
import { classifyError, QwenApiError } from "../../src/services/oauth/qwen/errors";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-integration-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("Qwen OAuth Integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("full save -> load -> validate cycle", async () => {
    const creds: QwenCredentials = {
      accessToken: "test-token",
      tokenType: "Bearer",
      refreshToken: "test-refresh",
      expiryDate: Date.now() + 3600000,
    };

    await saveCredentials(creds);
    const loaded = await loadCredentials();
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe("test-token");
    expect(loaded!.refreshToken).toBe("test-refresh");
  });

  test("token manager caches credentials", async () => {
    const tm = new TokenManager();
    const creds: QwenCredentials = {
      accessToken: "cached-token",
      tokenType: "Bearer",
      refreshToken: "refresh",
      expiryDate: Date.now() + 3600000,
    };
    tm.setCredentials(creds);

    const result = await tm.getValidCredentials();
    expect(result.accessToken).toBe("cached-token");
  });

  test("request queue throttles requests", async () => {
    const queue = new RequestQueue({ minIntervalMS: 50, jitterMinMS: 0, jitterMaxMS: 0 });
    const times: number[] = [];

    await queue.enqueue(async () => { times.push(Date.now()); return 1; });
    await queue.enqueue(async () => { times.push(Date.now()); return 2; });

    expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
  });

  test("error classification guides recovery", () => {
    const err401 = new QwenApiError("Unauthorized", 401, "unauthorized");
    const classification = classifyError(err401);
    expect(classification.isRetryable).toBe(true);
    expect(classification.shouldClearCache).toBe(true);
  });
});
