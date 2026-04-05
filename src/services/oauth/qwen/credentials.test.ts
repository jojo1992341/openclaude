import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  loadCredentials,
  saveCredentials,
  validateCredentials,
  getCredentialsPath,
  QwenCredentials,
} from "./credentials";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-creds-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("credentials", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("saveCredentials writes snake_case JSON", async () => {
    const creds: QwenCredentials = {
      accessToken: "test-token",
      tokenType: "Bearer",
      refreshToken: "refresh-token",
      expiryDate: Date.now() + 3600000,
      scope: "openid profile",
    };
    await saveCredentials(creds);
    expect(existsSync(TEST_CREDS_PATH)).toBe(true);
    const content = JSON.parse(readFileSync(TEST_CREDS_PATH, "utf-8"));
    expect(content.access_token).toBe("test-token");
    expect(content.token_type).toBe("Bearer");
    expect(content.refresh_token).toBe("refresh-token");
  });

  test("loadCredentials reads and converts to camelCase", async () => {
    const creds: QwenCredentials = {
      accessToken: "test-token",
      tokenType: "Bearer",
      refreshToken: "refresh-token",
      expiryDate: Date.now() + 3600000,
    };
    await saveCredentials(creds);
    const loaded = await loadCredentials();
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe("test-token");
    expect(loaded!.tokenType).toBe("Bearer");
  });

  test("loadCredentials returns null for missing file", async () => {
    rmSync(TEST_CREDS_PATH, { force: true });
    const loaded = await loadCredentials();
    expect(loaded).toBeNull();
  });

  test("loadCredentials returns null for corrupted file", async () => {
    rmSync(TEST_CREDS_PATH, { force: true });
    const content = "{ invalid json";
    writeFileSync(TEST_CREDS_PATH, content, "utf-8");
    const loaded = await loadCredentials();
    expect(loaded).toBeNull();
  });

  test("validateCredentials accepts valid credentials", () => {
    const creds: QwenCredentials = {
      accessToken: "token",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    expect(validateCredentials(creds)).toBe(true);
  });

  test("validateCredentials rejects missing accessToken", () => {
    const creds: any = { tokenType: "Bearer", expiryDate: Date.now() + 3600000 };
    expect(validateCredentials(creds)).toBe(false);
  });

  test("validateCredentials rejects missing tokenType", () => {
    const creds: any = { accessToken: "token", expiryDate: Date.now() + 3600000 };
    expect(validateCredentials(creds)).toBe(false);
  });

  test("validateCredentials rejects missing expiryDate", () => {
    const creds: any = { accessToken: "token", tokenType: "Bearer" };
    expect(validateCredentials(creds)).toBe(false);
  });

  test("validateCredentials rejects expired credentials", () => {
    const creds: QwenCredentials = {
      accessToken: "token",
      tokenType: "Bearer",
      expiryDate: Date.now() - 1000,
    };
    expect(validateCredentials(creds)).toBe(false);
  });

  test("validateCredentials rejects null", () => {
    expect(validateCredentials(null)).toBe(false);
  });

  test("getCredentialsPath returns test path when env var set", () => {
    expect(getCredentialsPath()).toBe(TEST_CREDS_PATH);
  });

  test("getCredentialsPath returns default when no env var", () => {
    delete process.env.QWEN_TEST_CREDS_PATH;
    const path = getCredentialsPath();
    expect(path).toContain(".qwen");
    expect(path).toContain("oauth_creds.json");
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
  });
});
