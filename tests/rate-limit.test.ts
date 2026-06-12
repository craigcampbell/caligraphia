import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit } from "../src/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `t1-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    const third = rateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window passes", () => {
    vi.useFakeTimers();
    const key = `t2-${Math.random()}`;
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(rateLimit(key, 1, 1_000).allowed).toBe(false);
    vi.advanceTimersByTime(1_100);
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
  });
});
