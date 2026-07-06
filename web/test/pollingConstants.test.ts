import { describe, expect, test } from "vitest";
import { POLL_COLD_MS, POLL_EVENT_MS, POLL_HOT_MS, POLL_WARM_MS } from "../lib/hooks/pollingConstants";

describe("polling constants", () => {
  test("exports configured intervals with increasing data tiers", () => {
    expect(POLL_HOT_MS).toBe(20_000);
    expect(POLL_WARM_MS).toBe(40_000);
    expect(POLL_COLD_MS).toBe(90_000);
    expect(POLL_EVENT_MS).toBe(15_000);

    expect(POLL_HOT_MS).toBeLessThan(POLL_WARM_MS);
    expect(POLL_WARM_MS).toBeLessThan(POLL_COLD_MS);
  });
});
