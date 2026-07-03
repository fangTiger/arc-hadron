// 进程内限流只在当前 Node.js 实例内生效；多实例部署需改用 Redis 等共享存储。
const WINDOW_MS = 60_000;

export interface SlidingWindowLimiterOptions {
  perIpPerMinute: number;
  globalPerMinute: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface SlidingWindowLimiter {
  check(ip: string): RateLimitResult;
}

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function pruneBucket(bucket: number[], nowMs: number) {
  const cutoff = nowMs - WINDOW_MS;

  while (bucket.length > 0 && bucket[0] <= cutoff) {
    bucket.shift();
  }
}

function retryAfterSeconds(bucket: readonly number[], nowMs: number): number {
  const oldest = bucket[0];

  if (oldest === undefined) {
    return 1;
  }

  return Math.max(1, Math.ceil((oldest + WINDOW_MS - nowMs) / 1000));
}

export function createSlidingWindowLimiter({
  globalPerMinute,
  now = Date.now,
  perIpPerMinute,
}: SlidingWindowLimiterOptions): SlidingWindowLimiter {
  assertPositiveInteger("perIpPerMinute", perIpPerMinute);
  assertPositiveInteger("globalPerMinute", globalPerMinute);

  const globalBucket: number[] = [];
  const ipBuckets = new Map<string, number[]>();

  return {
    check(ip: string): RateLimitResult {
      const nowMs = now();

      pruneBucket(globalBucket, nowMs);

      for (const [key, bucket] of ipBuckets) {
        pruneBucket(bucket, nowMs);

        if (bucket.length === 0) {
          ipBuckets.delete(key);
        }
      }

      const ipBucket = ipBuckets.get(ip) ?? [];
      ipBuckets.set(ip, ipBucket);

      const ipRetry =
        ipBucket.length >= perIpPerMinute ? retryAfterSeconds(ipBucket, nowMs) : 0;
      const globalRetry =
        globalBucket.length >= globalPerMinute ? retryAfterSeconds(globalBucket, nowMs) : 0;
      const retryAfter = Math.max(ipRetry, globalRetry);

      if (retryAfter > 0) {
        return {
          allowed: false,
          retryAfterSeconds: retryAfter,
        };
      }

      ipBucket.push(nowMs);
      globalBucket.push(nowMs);

      return { allowed: true };
    },
  };
}
