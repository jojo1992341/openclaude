import { createHash, randomBytes } from "crypto";

export function base64urlEncode(buffer: Uint8Array | Buffer): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64urlEncode(randomBytes(32));
  const hash = createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64urlEncode(new Uint8Array(hash));
  return { codeVerifier, codeChallenge };
}
