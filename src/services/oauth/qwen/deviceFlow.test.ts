import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  requestDeviceAuthorization,
  pollDeviceToken,
  refreshAccessToken,
  tokenResponseToCredentials,
  isCredentialsExpired,
  SlowDownError,
  QWEN_OAUTH_CONFIG,
} from "./deviceFlow";
import { generatePKCE } from "./pkce";
import { CredentialsClearRequiredError } from "./errors";

const mockFetch = mock();
globalThis.fetch = mockFetch;

describe("requestDeviceAuthorization", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns device code response on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        device_code: "abc123",
        user_code: "XYZ-ABC",
        verification_uri: "https://chat.qwen.ai/activate",
        verification_uri_complete: "https://chat.qwen.ai/activate?code=XYZ-ABC",
        expires_in: 1800,
      }),
    });

    const pkce = generatePKCE();
    const result = await requestDeviceAuthorization(pkce.codeChallenge);

    expect(result.device_code).toBe("abc123");
    expect(result.user_code).toBe("XYZ-ABC");
    expect(mockFetch).toHaveBeenCalledWith(
      QWEN_OAUTH_CONFIG.deviceCodeEndpoint,
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_client" }),
    });

    await expect(requestDeviceAuthorization("challenge")).rejects.toThrow();
  });
});

describe("pollDeviceToken", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns null on authorization_pending", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "authorization_pending" }),
    });

    const result = await pollDeviceToken("device_code", "verifier");
    expect(result).toBeNull();
  });

  test("throws SlowDownError on slow_down", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "slow_down" }),
    });

    await expect(pollDeviceToken("device_code", "verifier")).rejects.toThrow("slow_down");
  });

  test("throws CredentialsClearRequiredError on invalid_grant", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    });

    await expect(pollDeviceToken("device_code", "verifier")).rejects.toThrow(
      CredentialsClearRequiredError,
    );
  });

  test("returns token response on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });

    const result = await pollDeviceToken("device_code", "verifier");
    expect(result?.access_token).toBe("access");
    expect(result?.refresh_token).toBe("refresh");
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns new token on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });

    const result = await refreshAccessToken("old-refresh");
    expect(result.access_token).toBe("new-access");
  });

  test("throws CredentialsClearRequiredError on invalid_grant", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    });

    await expect(refreshAccessToken("revoked")).rejects.toThrow(CredentialsClearRequiredError);
  });
});

describe("tokenResponseToCredentials", () => {
  test("converts snake_case to camelCase", () => {
    const response = {
      access_token: "token",
      refresh_token: "refresh",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid",
      resource_url: "https://example.com",
    };

    const creds = tokenResponseToCredentials(response);
    expect(creds.accessToken).toBe("token");
    expect(creds.refreshToken).toBe("refresh");
    expect(creds.tokenType).toBe("Bearer");
    expect(creds.scope).toBe("openid");
    expect(creds.resourceUrl).toBe("https://example.com");
    expect(creds.expiryDate).toBeDefined();
  });
});

describe("isCredentialsExpired", () => {
  test("returns true for credentials with no expiry", () => {
    expect(isCredentialsExpired({ accessToken: "token", expiryDate: undefined })).toBe(true);
  });

  test("returns true for expired credentials", () => {
    expect(isCredentialsExpired({ accessToken: "token", expiryDate: Date.now() - 1000 })).toBe(true);
  });

  test("returns false for valid credentials with buffer", () => {
    expect(isCredentialsExpired({ accessToken: "token", expiryDate: Date.now() + 60000 })).toBe(false);
  });

  test("returns true for credentials expiring within buffer", () => {
    expect(isCredentialsExpired({ accessToken: "token", expiryDate: Date.now() + 10000 })).toBe(true);
  });
});
