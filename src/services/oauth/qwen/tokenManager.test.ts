import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TokenManager } from "./tokenManager";
import { QwenCredentials } from "./credentials";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-tokenmanager-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("TokenManager", () => {
  let tm: TokenManager;

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
    tm = new TokenManager();
    tm.clearCache();
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("returns cached credentials", async () => {
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

  test("throws when no refresh token available and cache empty", async () => {
    // No file exists, no cache — should fail with NO_REFRESH_TOKEN
    await expect(tm.getValidCredentials()).rejects.toThrow("No refresh token");
  });

  test("clearCache removes cached credentials", async () => {
    const creds: QwenCredentials = {
      accessToken: "token",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    tm.setCredentials(creds);
    tm.clearCache();
    // Next call should try to load from file (which doesn't exist)
    await expect(tm.getValidCredentials()).rejects.toThrow("No refresh token");
  });

  test("clear resets cache", async () => {
    const creds: QwenCredentials = {
      accessToken: "token",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    tm.setCredentials(creds);
    await tm.clear();
    await expect(tm.getValidCredentials()).rejects.toThrow("No refresh token");
  });

  test("prevents concurrent refreshes", async () => {
    const creds: QwenCredentials = {
      accessToken: "cached",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    tm.setCredentials(creds);

    const [r1, r2] = await Promise.all([
      tm.getValidCredentials(),
      tm.getValidCredentials(),
    ]);
    expect(r1).toBe(r2);
  });

  test("loads valid credentials from file", async () => {
    const snakeCase = {
      access_token: "file-token",
      token_type: "Bearer",
      refresh_token: "refresh",
      expiry_date: Date.now() + 3600000,
    };
    writeFileSync(TEST_CREDS_PATH, JSON.stringify(snakeCase), "utf-8");

    const freshTm = new TokenManager();
    const result = await freshTm.getValidCredentials();
    expect(result.accessToken).toBe("file-token");
  });

  test("ignores expired credentials from file (no refresh token)", async () => {
    const snakeCase = {
      access_token: "expired",
      token_type: "Bearer",
      expiry_date: Date.now() - 1000,
      // No refresh_token — can't refresh
    };
    writeFileSync(TEST_CREDS_PATH, JSON.stringify(snakeCase), "utf-8");

    const freshTm = new TokenManager();
    await expect(freshTm.getValidCredentials()).rejects.toThrow("No refresh token");
  });

  test("ignores corrupted credentials file", async () => {
    writeFileSync(TEST_CREDS_PATH, "{ invalid json", "utf-8");

    const freshTm = new TokenManager();
    await expect(freshTm.getValidCredentials()).rejects.toThrow("No refresh token");
  });
});
