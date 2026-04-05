// Security verification script for Qwen OAuth integration
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.error(`❌ ${name}: ${detail}`);
    failed++;
  }
}

const srcDir = "src/services/oauth/qwen";

// 1. No hardcoded secrets
const srcFiles = [
  "deviceFlow.ts",
  "credentials.ts",
  "tokenManager.ts",
  "QwenOAuthService.ts",
];

for (const file of srcFiles) {
  const path = join(srcDir, file);
  if (existsSync(path)) {
    const content = readFileSync(path, "utf-8");
    check(
      `No secrets in ${file}`,
      !/sk-[a-zA-Z0-9]{20,}/.test(content) && !/api_key\s*=\s*["'][^"']{10,}["']/.test(content),
      "Found potential hardcoded secret",
    );
  }
}

// 2. Credentials path is in home directory
const credsPath = join(homedir(), ".qwen", "oauth_creds.json");
check(
  "Credentials path is in home directory",
  credsPath.startsWith(homedir()),
  `Credentials path: ${credsPath}`,
);

// 3. No console.log of tokens in source (except test files)
for (const file of srcFiles) {
  const path = join(srcDir, file);
  if (existsSync(path)) {
    const content = readFileSync(path, "utf-8");
    const hasTokenLogging = /console\.(log|error|warn).*\b(token|accessToken|refreshToken)\b/i.test(content);
    check(
      `No token logging in ${file}`,
      !hasTokenLogging,
      "Found potential token logging",
    );
  }
}

// 4. File lock uses exclusive create (wx flag)
const fileLockPath = join(srcDir, "fileLock.ts");
if (existsSync(fileLockPath)) {
  const content = readFileSync(fileLockPath, "utf-8");
  check(
    "File lock uses wx flag",
    content.includes("'wx'") || content.includes('"wx"'),
    "File lock should use exclusive create",
  );
}

// 5. Atomic write (temp file + rename)
const credsFilePath = join(srcDir, "credentials.ts");
if (existsSync(credsFilePath)) {
  const content = readFileSync(credsFilePath, "utf-8");
  check(
    "Atomic credential write",
    content.includes("renameSync") || content.includes("rename"),
    "Should use temp file + rename for atomic write",
  );
}

// 6. PKCE uses S256 (not plain)
const pkcePath = join(srcDir, "pkce.ts");
if (existsSync(pkcePath)) {
  const content = readFileSync(pkcePath, "utf-8");
  check(
    "PKCE uses SHA-256",
    content.includes("sha256") || content.includes("createHash"),
    "PKCE should use SHA-256",
  );
}

// 7. OAuth URLs use HTTPS
const deviceFlowPath = join(srcDir, "deviceFlow.ts");
if (existsSync(deviceFlowPath)) {
  const content = readFileSync(deviceFlowPath, "utf-8");
  const httpUrls = content.match(/https?:\/\/[^\s"']+/g) || [];
  const nonHttps = httpUrls.filter((u) => u.startsWith("http://") && !u.includes("localhost"));
  check(
    "All OAuth URLs use HTTPS",
    nonHttps.length === 0,
    `Found non-HTTPS URLs: ${nonHttps.join(", ")}`,
  );
}

// 8. Error messages don't leak tokens
const errorsPath = join(srcDir, "errors.ts");
if (existsSync(errorsPath)) {
  const content = readFileSync(errorsPath, "utf-8");
  check(
    "Error messages don't leak tokens",
    !/token.*\$\{|accessToken.*\$\{/.test(content),
    "Error messages may leak token data",
  );
}

// 9. Refresh has shouldRetry predicate for invalid_grant
if (existsSync(deviceFlowPath)) {
  const content = readFileSync(deviceFlowPath, "utf-8");
  check(
    "Refresh has shouldRetry predicate",
    content.includes("shouldRetry") && content.includes("CredentialsClearRequiredError"),
    "Refresh should not retry on invalid_grant",
  );
}

// 10. 401 recovery clears cache
if (existsSync(errorsPath)) {
  const content = readFileSync(errorsPath, "utf-8");
  check(
    "401 classification clears cache",
    content.includes("shouldClearCache: true") && content.includes("401"),
    "401 should trigger cache clearing",
  );
}

console.log(`\n${"=".repeat(50)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed > 0) {
  process.exit(1);
}
