import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { QwenOAuthService } from "./QwenOAuthService";
import { TokenManager } from "./tokenManager";
import { RequestQueue } from "./requestQueue";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "qwen-oauthservice-test");
const TEST_CREDS_PATH = join(TEST_DIR, "oauth_creds.json");

describe("QwenOAuthService", () => {
  let service: QwenOAuthService;
  let mockTokenManager: TokenManager;
  let mockRequestQueue: RequestQueue;

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.QWEN_TEST_CREDS_PATH = TEST_CREDS_PATH;
    mockTokenManager = new TokenManager();
    mockRequestQueue = new RequestQueue();
    service = new QwenOAuthService(mockTokenManager, mockRequestQueue);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.QWEN_TEST_CREDS_PATH;
  });

  test("has correct provider id and label", () => {
    expect(service.id).toBe("qwen-code");
    expect(service.label).toBe("Qwen Code (qwen.ai OAuth)");
  });

  test("exposes tokenManager and requestQueue", () => {
    expect(service.tokenManager).toBe(mockTokenManager);
    expect(service.requestQueue).toBe(mockRequestQueue);
  });

  test("getCredentials returns null when no credentials", async () => {
    const creds = await service.getCredentials();
    expect(creds).toBeNull();
  });

  test("getCredentials returns credentials when set", async () => {
    const mockCreds = {
      accessToken: "cached",
      tokenType: "Bearer",
      refreshToken: "refresh",
      expiryDate: Date.now() + 3600000,
    };
    mockTokenManager.setCredentials(mockCreds);

    const creds = await service.getCredentials();
    expect(creds?.accessToken).toBe("cached");
  });

  test("clearCredentials clears token manager cache", async () => {
    const mockCreds = {
      accessToken: "cached",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    mockTokenManager.setCredentials(mockCreds);
    await service.clearCredentials();
    const creds = await service.getCredentials();
    expect(creds).toBeNull();
  });

  test("revoke clears credentials", async () => {
    const mockCreds = {
      accessToken: "cached",
      tokenType: "Bearer",
      expiryDate: Date.now() + 3600000,
    };
    mockTokenManager.setCredentials(mockCreds);
    await service.revoke!("any-token");
    const creds = await service.getCredentials();
    expect(creds).toBeNull();
  });

  test("creates default instances when no args provided", () => {
    const standalone = new QwenOAuthService();
    expect(standalone.tokenManager).toBeDefined();
    expect(standalone.requestQueue).toBeDefined();
  });
});
