import { createHash } from "crypto";
import { generatePKCE, base64urlEncode } from "./pkce";
import { QwenCredentials } from "./credentials";
import { CredentialsClearRequiredError } from "./errors";
import { retryWithBackoff } from "./retry";

export const QWEN_OAUTH_CONFIG = {
  baseUrl: "https://chat.qwen.ai",
  deviceCodeEndpoint: "https://chat.qwen.ai/api/v1/oauth2/device/code",
  tokenEndpoint: "https://chat.qwen.ai/api/v1/oauth2/token",
  clientId: "f0304373b74a44d2b584a3fb70ca9e56",
  scope: "openid profile email model.completion",
  grantType: "urn:ietf:params:oauth:grant-type:device_code",
};

const TOKEN_REFRESH_BUFFER_MS = 30_000;

export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  resource_url?: string;
}

export class SlowDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlowDownError";
  }
}

function objectToUrlEncoded(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

export async function requestDeviceAuthorization(
  codeChallenge: string,
): Promise<DeviceAuthorizationResponse> {
  const response = await fetch(QWEN_OAUTH_CONFIG.deviceCodeEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: objectToUrlEncoded({
      client_id: QWEN_OAUTH_CONFIG.clientId,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: QWEN_OAUTH_CONFIG.scope,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Device authorization failed: ${body.error || response.status}`);
  }

  return response.json();
}

export async function pollDeviceToken(
  deviceCode: string,
  codeVerifier: string,
): Promise<TokenResponse | null> {
  const response = await fetch(QWEN_OAUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: objectToUrlEncoded({
      client_id: QWEN_OAUTH_CONFIG.clientId,
      grant_type: QWEN_OAUTH_CONFIG.grantType,
      device_code: deviceCode,
      code_verifier: codeVerifier,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    if (body.error === "authorization_pending") {
      return null;
    }
    if (body.error === "slow_down") {
      throw new SlowDownError("slow_down");
    }
    if (body.error === "invalid_grant") {
      throw new CredentialsClearRequiredError("Refresh token revoked");
    }
    throw new Error(`Token request failed: ${body.error || response.status}`);
  }

  return body as TokenResponse;
}

export function isCredentialsExpired(creds: { accessToken: string; expiryDate?: number }): boolean {
  if (!creds.expiryDate) return true;
  return Date.now() >= creds.expiryDate - TOKEN_REFRESH_BUFFER_MS;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(QWEN_OAUTH_CONFIG.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: objectToUrlEncoded({
          client_id: QWEN_OAUTH_CONFIG.clientId,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        if (body.error === "invalid_grant") {
          throw new CredentialsClearRequiredError("Refresh token revoked");
        }
        throw new Error(`Token refresh failed: ${body.error || response.status}`);
      }

      return body as TokenResponse;
    },
    {
      maxRetries: 5,
      initialDelayMS: 1000,
      shouldRetry: (err) => !(err instanceof CredentialsClearRequiredError),
    },
  );
}

export function tokenResponseToCredentials(response: TokenResponse): QwenCredentials {
  return {
    accessToken: response.access_token,
    tokenType: response.token_type,
    refreshToken: response.refresh_token,
    resourceUrl: response.resource_url,
    expiryDate: response.expires_in ? Date.now() + response.expires_in * 1000 : undefined,
    scope: response.scope,
  };
}

export interface DeviceAuthFlowOptions {
  onVerificationUrl?: (url: string, userCode: string) => void;
  pollIntervalMS?: number;
  timeoutMS?: number;
}

export async function performDeviceAuthFlow(
  options: DeviceAuthFlowOptions = {},
): Promise<QwenCredentials> {
  const pkce = generatePKCE();
  const deviceAuth = await requestDeviceAuthorization(pkce.codeChallenge);

  if (options.onVerificationUrl) {
    options.onVerificationUrl(deviceAuth.verification_uri_complete, deviceAuth.user_code);
  }

  const pollIntervalMS = options.pollIntervalMS ?? 5000;
  const timeoutMS = options.timeoutMS ?? deviceAuth.expires_in * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMS) {
    try {
      const token = await pollDeviceToken(deviceAuth.device_code, pkce.codeVerifier);
      if (token) {
        return tokenResponseToCredentials(token);
      }
    } catch (err: any) {
      if (err instanceof SlowDownError) {
        await new Promise((r) => setTimeout(r, pollIntervalMS * 0.5));
      } else {
        throw err;
      }
    }

    await new Promise((r) => setTimeout(r, pollIntervalMS));
  }

  throw new Error("Device auth flow timed out");
}
