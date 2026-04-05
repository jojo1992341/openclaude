// Re-export everything from the existing OAuth modules
export * from './client.js';
export * from './crypto.js';
export * from './getOauthProfile.js';
export * from './auth-code-listener.js';

// Re-export Qwen OAuth modules
export { QwenOAuthService } from './qwen/QwenOAuthService.js';
export { TokenManager } from './qwen/tokenManager.js';
export { RequestQueue } from './qwen/requestQueue.js';
export {
  QwenAuthError,
  CredentialsClearRequiredError,
  QwenApiError,
  QwenNetworkError,
  TokenManagerError,
  classifyError,
} from './qwen/errors.js';
export { generatePKCE, base64urlEncode } from './qwen/pkce.js';
export { FileLock } from './qwen/fileLock.js';
export { retryWithBackoff } from './qwen/retry.js';
export {
  QwenCredentials,
  loadCredentials,
  saveCredentials,
  validateCredentials,
  getCredentialsPath,
} from './qwen/credentials.js';
export {
  performDeviceAuthFlow,
  refreshAccessToken,
  tokenResponseToCredentials,
  isCredentialsExpired,
  pollDeviceToken,
  requestDeviceAuthorization,
  SlowDownError,
  QWEN_OAUTH_CONFIG,
} from './qwen/deviceFlow.js';

// Re-export orchestrator
export { oauthOrchestrator, UnifiedOAuthOrchestrator, OAuthProvider } from './orchestrator.js';

// OAuthService wrapper for Claude AI OAuth flow (used by auth handler)
import {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshOAuthToken,
  fetchProfileInfo,
} from './client.js';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './crypto.js';
import { AuthCodeListener } from './auth-code-listener.js';

export class OAuthService {
  private listener: AuthCodeListener | null = null;

  async startOAuthFlow(
    onUrl: (url: string) => Promise<void> | void,
    options?: { scopes?: string[]; loginHint?: string },
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    this.listener = new AuthCodeListener();
    const port = await this.listener.start();

    const authUrl = buildAuthUrl({
      codeChallenge,
      state,
      port,
      scopes: options?.scopes,
      loginHint: options?.loginHint,
    });

    await onUrl(authUrl);

    const { code, returnedState } = await this.listener.waitForCode();

    if (returnedState !== state) {
      throw new Error('OAuth state mismatch');
    }

    const tokens = await exchangeCodeForTokens(code, codeVerifier);

    const profile = await fetchProfileInfo(tokens.access_token);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
    };
  }

  cleanup(): void {
    if (this.listener) {
      this.listener.close();
      this.listener = null;
    }
  }
}
