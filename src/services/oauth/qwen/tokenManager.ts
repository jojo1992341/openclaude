import { QwenCredentials, loadCredentials, saveCredentials, validateCredentials } from "./credentials";
import { refreshAccessToken, tokenResponseToCredentials, isCredentialsExpired } from "./deviceFlow";
import { TokenManagerError } from "./errors";
import { FileLock } from "./fileLock";
import { getCredentialsPath } from "./credentials";

interface CacheState {
  credentials: QwenCredentials;
  lastCheck: number;
}

const CACHE_CHECK_INTERVAL_MS = 5000;

export class TokenManager {
  private cache: CacheState | null = null;
  private refreshPromise: Promise<QwenCredentials> | null = null;

  async getValidCredentials(forceRefresh = false): Promise<QwenCredentials> {
    if (!forceRefresh && this.cache && !isCredentialsExpired(this.cache.credentials)) {
      return this.cache.credentials;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<QwenCredentials> {
    const loaded = await loadCredentials();
    if (loaded && validateCredentials(loaded)) {
      this.cache = { credentials: loaded, lastCheck: Date.now() };
      return loaded;
    }

    if (!loaded?.refreshToken) {
      throw new TokenManagerError("No refresh token available", "NO_REFRESH_TOKEN");
    }

    const lockPath = getCredentialsPath() + ".lock";
    const lock = new FileLock(lockPath);

    return lock.withLock(async () => {
      const reloaded = await loadCredentials();
      if (reloaded && validateCredentials(reloaded)) {
        this.cache = { credentials: reloaded, lastCheck: Date.now() };
        return reloaded;
      }

      const tokenResponse = await refreshAccessToken(loaded!.refreshToken!);
      const newCreds = tokenResponseToCredentials(tokenResponse);
      await saveCredentials(newCreds);
      this.cache = { credentials: newCreds, lastCheck: Date.now() };
      return newCreds;
    });
  }

  setCredentials(creds: QwenCredentials): void {
    this.cache = { credentials: creds, lastCheck: Date.now() };
  }

  clearCache(): void {
    this.cache = null;
  }

  async clear(): Promise<void> {
    this.cache = null;
  }
}
