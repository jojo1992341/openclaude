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

export interface Credentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope?: string;
  resourceUrl?: string;
}

export interface OAuthProvider {
  id: string;
  label: string;
  authorize(options?: AuthOptions): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<any>;
  revoke?(token: string): Promise<void>;
  getCredentials(): Promise<Credentials | null>;
  clearCredentials(): Promise<void>;
}

export class UnifiedOAuthOrchestrator {
  private providers = new Map<string, OAuthProvider>();

  register(provider: OAuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  route(providerId: string): OAuthProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(
        `OAuth provider '${providerId}' not found. Available: ${Array.from(this.providers.keys()).join(", ")}`
      );
    }
    return provider;
  }

  async authorize(providerId: string, options?: AuthOptions): Promise<AuthResult> {
    const provider = this.route(providerId);
    return provider.authorize(options);
  }

  async getValidCredentials(providerId: string): Promise<Credentials> {
    const provider = this.route(providerId);
    const creds = await provider.getCredentials();
    if (!creds) {
      throw new Error(`No valid credentials for '${providerId}'. Please authenticate first.`);
    }
    return creds;
  }

  async revoke(providerId: string, token: string): Promise<void> {
    const provider = this.route(providerId);
    if (provider.revoke) {
      await provider.revoke(token);
    }
  }
}

export const oauthOrchestrator = new UnifiedOAuthOrchestrator();
