import { describe, test, expect } from "bun:test";
import { generatePKCE, base64urlEncode } from "./pkce";

describe("generatePKCE", () => {
  test("returns verifier and challenge", () => {
    const pkce = generatePKCE();
    expect(pkce.codeVerifier).toBeDefined();
    expect(pkce.codeChallenge).toBeDefined();
  });

  test("verifier is 32 bytes (43 base64url chars)", () => {
    const pkce = generatePKCE();
    expect(pkce.codeVerifier.length).toBe(43);
  });

  test("challenge is valid base64url", () => {
    const pkce = generatePKCE();
    expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]+=*$/);
  });

  test("verifier and challenge are different", () => {
    const pkce = generatePKCE();
    expect(pkce.codeVerifier).not.toBe(pkce.codeChallenge);
  });

  test("generates unique verifiers", () => {
    const pkce1 = generatePKCE();
    const pkce2 = generatePKCE();
    expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
  });
});

describe("base64urlEncode", () => {
  test("encodes without padding", () => {
    const input = new Uint8Array([0xfb, 0xff, 0xff]);
    const result = base64urlEncode(input);
    expect(result).not.toContain("=");
  });

  test("replaces + with - and / with _", () => {
    const input = new Uint8Array([0x7f, 0x3f, 0x7e]);
    const result = base64urlEncode(input);
    expect(result).not.toContain("+");
    expect(result).not.toContain("/");
  });
});
