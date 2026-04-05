import React from "react";

interface AuthQwenCommandProps {
  action?: "login" | "status" | "revoke" | "clear";
}

export function AuthQwenCommand({ action = "login" }: AuthQwenCommandProps) {
  const [status, setStatus] = React.useState<string>("Initializing...");

  React.useEffect(() => {
    const run = async () => {
      const { QwenOAuthService } = await import("../../services/oauth/qwen/QwenOAuthService");
      const service = new QwenOAuthService();

      switch (action) {
        case "login": {
          setStatus("Starting Qwen OAuth device flow...");
          try {
            const result = await service.authorize();
            if (result.type === "success") {
              setStatus(
                `Authenticated! Token expires at ${new Date(result.expiresAt!).toLocaleString()}`
              );
            } else {
              setStatus(`Authentication ${result.type}.`);
            }
          } catch (err: any) {
            setStatus(`Error: ${err.message}`);
          }
          break;
        }
        case "status": {
          const creds = await service.getCredentials();
          if (creds) {
            setStatus(
              `Authenticated. Token expires at ${new Date(creds.expiryDate!).toLocaleString()}`
            );
          } else {
            setStatus("Not authenticated. Run with 'login' action.");
          }
          break;
        }
        case "clear": {
          await service.clearCredentials();
          setStatus("Qwen credentials cleared.");
          break;
        }
        case "revoke": {
          await service.clearCredentials();
          setStatus("Qwen credentials revoked.");
          break;
        }
        default:
          setStatus("Unknown action. Use: login, status, clear, revoke");
      }
    };

    run();
  }, [action]);

  return React.createElement("div", null, status);
}

export default AuthQwenCommand;
