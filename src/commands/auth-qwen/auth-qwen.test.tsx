import { describe, test, expect } from "bun:test";
import { AuthQwenCommand } from "./auth-qwen";

describe("AuthQwenCommand", () => {
  test("exports AuthQwenCommand component", () => {
    expect(AuthQwenCommand).toBeDefined();
    expect(typeof AuthQwenCommand).toBe("function");
  });
});
