import { describe, test, expect } from "bun:test";
import {
  QwenAuthError,
  CredentialsClearRequiredError,
  QwenApiError,
  QwenNetworkError,
  TokenManagerError,
  classifyError,
} from "./errors";

describe("QwenAuthError", () => {
  test("creates with kind", () => {
    const err = new QwenAuthError("Token expired", "token_expired");
    expect(err.message).toContain("Token expired");
    expect(err.kind).toBe("token_expired");
    expect(err).toBeInstanceOf(Error);
  });

  test("includes helpful hint in message", () => {
    const err = new QwenAuthError("Auth required", "auth_required");
    expect(err.message).toContain("auth");
  });
});

describe("CredentialsClearRequiredError", () => {
  test("extends QwenAuthError with credentials_clear_required kind", () => {
    const err = new CredentialsClearRequiredError("Refresh token revoked");
    expect(err).toBeInstanceOf(QwenAuthError);
    expect(err.kind).toBe("credentials_clear_required");
  });
});

describe("QwenApiError", () => {
  test("creates with statusCode and kind", () => {
    const err = new QwenApiError("Rate limited", 429, "rate_limit");
    expect(err.statusCode).toBe(429);
    expect(err.kind).toBe("rate_limit");
  });

  test("classifies 401 as unauthorized", () => {
    const err = new QwenApiError("Unauthorized", 401, "unauthorized");
    expect(err.kind).toBe("unauthorized");
  });

  test("classifies 403 as forbidden", () => {
    const err = new QwenApiError("Forbidden", 403, "forbidden");
    expect(err.kind).toBe("forbidden");
  });
});

describe("QwenNetworkError", () => {
  test("creates with message", () => {
    const err = new QwenNetworkError("Connection refused");
    expect(err.message).toBe("Connection refused");
  });
});

describe("TokenManagerError", () => {
  test("creates with type", () => {
    const err = new TokenManagerError("Refresh failed", "REFRESH_FAILED");
    expect(err.type).toBe("REFRESH_FAILED");
  });
});

describe("classifyError", () => {
  test("429 QwenApiError is retryable", () => {
    const err = new QwenApiError("Rate limited", 429, "rate_limit");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(true);
    expect(result.shouldClearCache).toBe(false);
  });

  test("401 QwenApiError is retryable and clears cache", () => {
    const err = new QwenApiError("Unauthorized", 401, "unauthorized");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(true);
    expect(result.shouldClearCache).toBe(true);
  });

  test("5xx QwenApiError is retryable", () => {
    const err = new QwenApiError("Server error", 500, "server_error");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(true);
  });

  test("403 QwenApiError is NOT retryable", () => {
    const err = new QwenApiError("Forbidden", 403, "forbidden");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(false);
  });

  test("CredentialsClearRequiredError is NOT retryable and clears cache", () => {
    const err = new CredentialsClearRequiredError("Revoked");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(false);
    expect(result.shouldClearCache).toBe(true);
  });

  test("QwenNetworkError is retryable", () => {
    const err = new QwenNetworkError("Timeout");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(true);
  });

  test("TokenManagerError REFRESH_FAILED is NOT retryable", () => {
    const err = new TokenManagerError("Failed", "REFRESH_FAILED");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(false);
  });

  test("unknown error returns safe defaults", () => {
    const err = new Error("Something weird");
    const result = classifyError(err);
    expect(result.isRetryable).toBe(false);
    expect(result.shouldClearCache).toBe(false);
  });
});
