import { describe, expect, test } from "vitest";
import { createSlidingWindowLimiter } from "../lib/ai/rateLimit";

describe("AI sliding window rate limiter", () => {
  test("limits each IP and recovers exactly when the one-minute window slides out", () => {
    let nowMs = 0;
    const limiter = createSlidingWindowLimiter({
      perIpPerMinute: 2,
      globalPerMinute: 10,
      now: () => nowMs,
    });

    expect(limiter.check("203.0.113.1")).toEqual({ allowed: true });
    expect(limiter.check("203.0.113.1")).toEqual({ allowed: true });
    expect(limiter.check("203.0.113.1")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.check("203.0.113.2")).toEqual({ allowed: true });

    nowMs = 59_999;
    expect(limiter.check("203.0.113.1")).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });

    nowMs = 60_000;
    expect(limiter.check("203.0.113.1")).toEqual({ allowed: true });
  });

  test("enforces the global limit even when each IP still has quota", () => {
    let nowMs = 1_000;
    const limiter = createSlidingWindowLimiter({
      perIpPerMinute: 10,
      globalPerMinute: 3,
      now: () => nowMs,
    });

    expect(limiter.check("203.0.113.1")).toEqual({ allowed: true });
    expect(limiter.check("203.0.113.2")).toEqual({ allowed: true });
    expect(limiter.check("203.0.113.3")).toEqual({ allowed: true });
    expect(limiter.check("203.0.113.4")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });

    nowMs = 61_000;
    expect(limiter.check("203.0.113.4")).toEqual({ allowed: true });
  });
});
