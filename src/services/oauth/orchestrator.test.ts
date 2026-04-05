import { describe, test, expect, mock } from "bun:test";
import { UnifiedOAuthOrchestrator, OAuthProvider, AuthResult, Credentials } from "./orchestrator";

function createMockProvider(id: string, label: string): OAuthProvider {
  return {
    id,
    label,
    authorize: mock(() => Promise.resolve<AuthResult>({ type: "success", accessToken: "mock-token" })),
    refresh: mock(() => Promise.resolve({ access_token: "new", token_type: "Bearer" })),
    getCredentials: mock(() =>
      Promise.resolve<Credentials | null>({
        accessToken: "mock",
        tokenType: "Bearer",
        expiresAt: Date.now() + 3600000,
      })
    ),
    clearCredentials: mock(() => Promise.resolve()),
  };
}

describe("UnifiedOAuthOrchestrator", () => {
  test("registers and routes to provider", () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");

    orchestrator.register(provider);
    const routed = orchestrator.route("test");

    expect(routed).toBe(provider);
  });

  test("throws on unknown provider", () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    expect(() => orchestrator.route("unknown")).toThrow("unknown");
  });

  test("throws with available providers list", () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    orchestrator.register(createMockProvider("a", "A"));
    orchestrator.register(createMockProvider("b", "B"));
    expect(() => orchestrator.route("missing")).toThrow("a, b");
  });

  test("authorizes through routed provider", async () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");
    orchestrator.register(provider);

    const result = await orchestrator.authorize("test");
    expect(result.type).toBe("success");
    expect(result.accessToken).toBe("mock-token");
    expect(provider.authorize).toHaveBeenCalled();
  });

  test("gets valid credentials through routed provider", async () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");
    orchestrator.register(provider);

    const creds = await orchestrator.getValidCredentials("test");
    expect(creds.accessToken).toBe("mock");
    expect(provider.getCredentials).toHaveBeenCalled();
  });

  test("throws when no credentials available", async () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");
    provider.getCredentials = mock(() => Promise.resolve(null));
    orchestrator.register(provider);

    await expect(orchestrator.getValidCredentials("test")).rejects.toThrow("No valid credentials");
  });

  test("revokes through routed provider", async () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");
    provider.revoke = mock(() => Promise.resolve());
    orchestrator.register(provider);

    await orchestrator.revoke("test", "token-to-revoke");
    expect(provider.revoke).toHaveBeenCalledWith("token-to-revoke");
  });

  test("revokes silently when provider has no revoke method", async () => {
    const orchestrator = new UnifiedOAuthOrchestrator();
    const provider = createMockProvider("test", "Test Provider");
    delete (provider as any).revoke;
    orchestrator.register(provider);

    await expect(orchestrator.revoke("test", "token")).resolves.toBeUndefined();
  });
});
