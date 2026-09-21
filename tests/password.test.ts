import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes a password to a bcrypt string", async () => {
    const hash = await hashPassword("hello-world-123");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toContain("hello-world-123");
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("does not throw on a malformed hash", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });
});