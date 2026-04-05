import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TokenManager } from "../../src/services/oauth/qwen/tokenManager";
import { QwenApiError, classifyError } from "../../src/services/oauth/qwen/errors";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-401-recovery-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("401 Recovery", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("classifies 401 as retryable with cache clear", () => {
    const error = new QwenApiError("Unauthorized", 401, "unauthorized");
    const classification = classifyError(error);
    expect(classification.isRetryable).toBe(true);
    expect(classification.shouldClearCache).toBe(true);
  });

  test("recovery flow: clear cache then check", async () => {
    const tm = new TokenManager();
    tm.setCredentials({
      accessToken: "expired-token",
      tokenType: "Bearer",
      expiryDate: Date.now() - 1000,
    });

    const error = new QwenApiError("Unauthorized", 401, "unauthorized");
    const classification = classifyError(error);

    if (classification.shouldClearCache) {
      tm.clearCache();
    }

    // After clearing, getValidCredentials should fail (no refresh token)
    await expect(tm.getValidCredentials()).rejects.toThrow("No refresh token");
  });
});
