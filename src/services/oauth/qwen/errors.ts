const AUTH_HINT = 'Run "/auth qwen login" to authenticate.';

export class QwenAuthError extends Error {
  constructor(
    message: string,
    public kind: "token_expired" | "refresh_failed" | "auth_required" | "credentials_clear_required",
  ) {
    super(`${message} ${AUTH_HINT}`);
    this.name = "QwenAuthError";
  }
}

export class CredentialsClearRequiredError extends QwenAuthError {
  constructor(message: string) {
    super(message, "credentials_clear_required");
    this.name = "CredentialsClearRequiredError";
  }
}

export class QwenApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public kind: "rate_limit" | "unauthorized" | "forbidden" | "server_error" | "network_error" | "unknown",
  ) {
    super(message);
    this.name = "QwenApiError";
  }
}

export class QwenNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QwenNetworkError";
  }
}

export class TokenManagerError extends Error {
  constructor(
    message: string,
    public type: "REFRESH_FAILED" | "NO_REFRESH_TOKEN" | "LOCK_TIMEOUT" | "FILE_ACCESS_ERROR" | "NETWORK_ERROR" | "CREDENTIALS_CLEAR_REQUIRED",
  ) {
    super(message);
    this.name = "TokenManagerError";
  }
}

export type ErrorClassification = {
  kind: string;
  isRetryable: boolean;
  shouldClearCache: boolean;
};

export function classifyError(error: Error): ErrorClassification {
  if (error instanceof QwenApiError) {
    if (error.statusCode === 401) {
      return { kind: "unauthorized", isRetryable: true, shouldClearCache: true };
    }
    if (error.statusCode === 429 || error.statusCode >= 500) {
      return { kind: error.kind, isRetryable: true, shouldClearCache: false };
    }
    if (error.statusCode === 403) {
      return { kind: "forbidden", isRetryable: false, shouldClearCache: false };
    }
    return { kind: error.kind, isRetryable: false, shouldClearCache: false };
  }

  if (error instanceof CredentialsClearRequiredError) {
    return { kind: "credentials_clear_required", isRetryable: false, shouldClearCache: true };
  }

  if (error instanceof QwenNetworkError) {
    return { kind: "network_error", isRetryable: true, shouldClearCache: false };
  }

  if (error instanceof TokenManagerError) {
    return { kind: error.type, isRetryable: false, shouldClearCache: false };
  }

  return { kind: "unknown", isRetryable: false, shouldClearCache: false };
}
