import { performDeviceAuthFlow, tokenResponseToCredentials, refreshAccessToken, TokenResponse } from "./deviceFlow";
import { TokenManager } from "./tokenManager";
import { RequestQueue } from "./requestQueue";
import { QwenCredentials } from "./credentials";

export interface AuthOptions {
  scopes?: string[];
  loginHint?: string;
  orgUUID?: string;
  onVerificationUrl?: (url: string, userCode: string) => void;
}

export interface AuthResult {
  type: "success" | "cancelled" | "expired";
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  profile?: Record<string, any>;
}

export class QwenOAuthService {
  readonly id = "qwen-code";
  readonly label = "Qwen Code (qwen.ai OAuth)";

  private _tokenManager: TokenManager;
  private _requestQueue: RequestQueue;

  constructor(tokenManager?: TokenManager, requestQueue?: RequestQueue) {
    this._tokenManager = tokenManager ?? new TokenManager();
    this._requestQueue = requestQueue ?? new RequestQueue();
  }

  get tokenManager(): TokenManager {
    return this._tokenManager;
  }

  get requestQueue(): RequestQueue {
    return this._requestQueue;
  }

  async authorize(options?: AuthOptions): Promise<AuthResult> {
    try {
      const creds = await performDeviceAuthFlow({
        onVerificationUrl: options?.onVerificationUrl ?? ((url, userCode) => {
          console.log(`\nVisit: ${url}`);
          console.log(`User code: ${userCode}\n`);
        }),
      });

      this._tokenManager.setCredentials(creds);

      return {
        type: "success",
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        expiresAt: creds.expiryDate,
      };
    } catch (err: any) {
      if (err.message?.includes("timed out")) {
        return { type: "expired" };
      }
      return { type: "cancelled" };
    }
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    return refreshAccessToken(refreshToken);
  }

  async getCredentials(): Promise<QwenCredentials | null> {
    try {
      return await this._tokenManager.getValidCredentials();
    } catch {
      return null;
    }
  }

  async clearCredentials(): Promise<void> {
    this._tokenManager.clearCache();
  }

  async revoke?(_token: string): Promise<void> {
    // Qwen doesn't support token revocation
    await this.clearCredentials();
  }
}
