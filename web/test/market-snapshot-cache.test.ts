import { describe, expect, test, vi } from "vitest";
import {
  MARKET_SNAPSHOT_TTL_MS,
  createTtlSnapshotLoader,
} from "../lib/api/marketSnapshotCache";

describe("market snapshot cache", () => {
  test("reuses a successful snapshot inside the 15 second TTL", async () => {
    let nowMs = 1_000;
    const load = vi.fn(async () => ({ version: 1 }));
    const snapshot = createTtlSnapshotLoader({
      load,
      now: () => nowMs,
      ttlMs: MARKET_SNAPSHOT_TTL_MS,
    });

    await expect(snapshot.get()).resolves.toEqual({ version: 1 });
    nowMs += MARKET_SNAPSHOT_TTL_MS - 1;
    await expect(snapshot.get()).resolves.toEqual({ version: 1 });

    expect(load).toHaveBeenCalledTimes(1);
  });

  test("deduplicates concurrent cold loads", async () => {
    let resolveLoad!: (value: { version: number }) => void;
    const load = vi.fn(
      () =>
        new Promise<{ version: number }>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const snapshot = createTtlSnapshotLoader({
      load,
      now: () => 1_000,
      ttlMs: MARKET_SNAPSHOT_TTL_MS,
    });

    const first = snapshot.get();
    const second = snapshot.get();

    await vi.waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });
    resolveLoad({ version: 1 });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { version: 1 },
      { version: 1 },
    ]);
  });

  test("keeps the last successful snapshot after a failed refresh and retries later", async () => {
    let nowMs = 1_000;
    const load = vi
      .fn<() => Promise<{ version: number }>>()
      .mockResolvedValueOnce({ version: 1 })
      .mockRejectedValueOnce(new Error("Arc RPC timeout"))
      .mockResolvedValueOnce({ version: 2 });
    const snapshot = createTtlSnapshotLoader({
      load,
      now: () => nowMs,
      ttlMs: MARKET_SNAPSHOT_TTL_MS,
    });

    await expect(snapshot.get()).resolves.toEqual({ version: 1 });
    nowMs += MARKET_SNAPSHOT_TTL_MS;
    await expect(snapshot.get()).rejects.toThrow("Arc RPC timeout");
    expect(snapshot.peek()).toEqual({ version: 1 });
    await expect(snapshot.get()).resolves.toEqual({ version: 2 });

    expect(load).toHaveBeenCalledTimes(3);
  });
});
