import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface QwenCredentials {
  accessToken: string;
  tokenType?: string;
  refreshToken?: string;
  resourceUrl?: string;
  expiryDate?: number;
  scope?: string;
}

const DEFAULT_CREDS_DIR = join(homedir(), ".qwen");
const DEFAULT_CREDS_FILE = join(DEFAULT_CREDS_DIR, "oauth_creds.json");

function getTestCredsPath(): string | null {
  return process.env.QWEN_TEST_CREDS_PATH ?? null;
}

export function getCredentialsPath(): string {
  return getTestCredsPath() ?? DEFAULT_CREDS_FILE;
}

function toSnakeCase(creds: QwenCredentials): Record<string, any> {
  return {
    access_token: creds.accessToken,
    token_type: creds.tokenType,
    refresh_token: creds.refreshToken,
    resource_url: creds.resourceUrl,
    expiry_date: creds.expiryDate,
    scope: creds.scope,
  };
}

function toCamelCase(data: Record<string, any>): QwenCredentials {
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    refreshToken: data.refresh_token,
    resourceUrl: data.resource_url,
    expiryDate: data.expiry_date,
    scope: data.scope,
  };
}

export async function saveCredentials(creds: QwenCredentials): Promise<void> {
  const filePath = getCredentialsPath();
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tempPath = filePath + ".tmp";
  const content = JSON.stringify(toSnakeCase(creds), null, 2);
  writeFileSync(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);
}

export async function loadCredentials(): Promise<QwenCredentials | null> {
  const filePath = getCredentialsPath();
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return toCamelCase(data);
  } catch {
    return null;
  }
}

export function validateCredentials(creds: QwenCredentials | null): boolean {
  if (!creds) return false;
  if (!creds.accessToken) return false;
  if (!creds.tokenType) return false;
  if (!creds.expiryDate) return false;
  if (Date.now() >= creds.expiryDate) return false;
  return true;
}
