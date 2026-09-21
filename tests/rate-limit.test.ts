import { describe, it, expect } from "vitest";
import { checkLimit, resetLimit } from "@/server/security/rate-limit";

describe("rate limiter", () => {
  it("allows attempts under the limit", () => {
    const key = `test-under-${Date.now()}`;
    for (let i = 0; i < 4; i++) {
      const r = checkLimit({ key, max: 5, windowMs: 1000, cooldownMs: 1000 });
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks after exceeding the limit", () => {
    const key = `test-over-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkLimit({ key, max: 5, windowMs: 1000, cooldownMs: 1000 });
    }
    const r = checkLimit({ key, max: 5, windowMs: 1000, cooldownMs: 1000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets when a key is cleared", () => {
    const key = `test-reset-${Date.now()}`;
    for (let i = 0; i < 6; i++) {
      checkLimit({ key, max: 5, windowMs: 1000, cooldownMs: 60_000 });
    }
    resetLimit(key);
    const r = checkLimit({ key, max: 5, windowMs: 1000, cooldownMs: 1000 });
    expect(r.allowed).toBe(true);
  });

  it("isolates keys from each other", () => {
    const a = `test-a-${Date.now()}`;
    const b = `test-b-${Date.now()}`;
    for (let i = 0; i < 6; i++) {
      checkLimit({ key: a, max: 5, windowMs: 1000, cooldownMs: 60_000 });
    }
    const r = checkLimit({ key: b, max: 5, windowMs: 1000, cooldownMs: 1000 });
    expect(r.allowed).toBe(true);
  });
});