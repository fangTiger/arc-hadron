import { loadAssetsPayload } from "@/lib/api/publicQuery";

export const MARKET_SNAPSHOT_TTL_MS = 15_000;

interface TtlSnapshotLoaderOptions<T> {
  load: () => Promise<T>;
  now?: () => number;
  ttlMs: number;
}

interface TtlSnapshotLoader<T> {
  get: () => Promise<T>;
  peek: () => T | undefined;
  reset: () => void;
}

export function createTtlSnapshotLoader<T>({
  load,
  now = Date.now,
  ttlMs,
}: TtlSnapshotLoaderOptions<T>): TtlSnapshotLoader<T> {
  let cached: { data: T; updatedAt: number } | undefined;
  let inFlight: Promise<T> | undefined;

  return {
    get() {
      const requestedAt = now();

      if (cached && requestedAt - cached.updatedAt < ttlMs) {
        return Promise.resolve(cached.data);
      }

      if (inFlight) {
        return inFlight;
      }

      const currentLoad = Promise.resolve()
        .then(load)
        .then((data) => {
          cached = { data, updatedAt: now() };
          return data;
        })
        .finally(() => {
          if (inFlight === currentLoad) {
            inFlight = undefined;
          }
        });

      inFlight = currentLoad;
      return currentLoad;
    },
    peek() {
      return cached?.data;
    },
    reset() {
      cached = undefined;
      inFlight = undefined;
    },
  };
}

const assetsSnapshot = createTtlSnapshotLoader({
  load: loadAssetsPayload,
  ttlMs: MARKET_SNAPSHOT_TTL_MS,
});

export function loadAssetsSnapshot() {
  return assetsSnapshot.get();
}

export function resetAssetsSnapshotForTest(): void {
  assetsSnapshot.reset();
}
