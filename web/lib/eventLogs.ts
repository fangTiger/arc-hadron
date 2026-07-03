import { planLogChunks, type LogChunk } from "@/lib/events";

export const EVENT_LOG_CHUNK_SIZE = 9_000n;
export const EVENT_LOG_CONCURRENCY = 6;
export const EVENT_LOG_RETRY_COUNT = 1;

interface FetchLogsInChunksInput<TLog> {
  chunks: readonly LogChunk[];
  concurrency?: number;
  getLogs: (chunk: LogChunk) => Promise<readonly TLog[]>;
  retryCount?: number;
}

interface FetchLogsInBlockRangeInput<TLog> {
  chunkSize?: bigint;
  concurrency?: number;
  fromBlock: bigint;
  getLogs: (chunk: LogChunk) => Promise<readonly TLog[]>;
  retryCount?: number;
  toBlock: bigint;
}

interface ChunkLogsResult<TLog> {
  failed: boolean;
  logs: readonly TLog[];
}

function warnSkippedLogChunk(chunk: LogChunk, error: unknown): void {
  console.warn(
    `Failed to load market logs for block range ${chunk.from.toString()}-${chunk.to.toString()}; skipping.`,
    error,
  );
}

async function getChunkLogsWithRetry<TLog>(
  chunk: LogChunk,
  getLogs: (chunk: LogChunk) => Promise<readonly TLog[]>,
  retryCount: number,
): Promise<ChunkLogsResult<TLog>> {
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return {
        failed: false,
        logs: await getLogs(chunk),
      };
    } catch (error) {
      if (attempt < retryCount) {
        continue;
      }

      warnSkippedLogChunk(chunk, error);
      return { failed: true, logs: [] };
    }
  }

  return { failed: true, logs: [] };
}

export async function fetchLogsInChunks<TLog>({
  chunks,
  concurrency = EVENT_LOG_CONCURRENCY,
  getLogs,
  retryCount = EVENT_LOG_RETRY_COUNT,
}: FetchLogsInChunksInput<TLog>): Promise<TLog[]> {
  if (chunks.length === 0) {
    return [];
  }

  const workerCount = Math.min(Math.max(1, concurrency), chunks.length);
  const results: TLog[][] = Array.from({ length: chunks.length }, () => []);
  let failedChunks = 0;
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < chunks.length) {
        const index = nextIndex;
        nextIndex += 1;

        const result = await getChunkLogsWithRetry(chunks[index], getLogs, retryCount);

        if (result.failed) {
          failedChunks += 1;
        }

        results[index] = [...result.logs];
      }
    }),
  );

  if (failedChunks === chunks.length) {
    throw new Error("Failed to load market event logs for all requested block ranges.");
  }

  return results.flat();
}

export function fetchLogsInBlockRange<TLog>({
  chunkSize = EVENT_LOG_CHUNK_SIZE,
  concurrency = EVENT_LOG_CONCURRENCY,
  fromBlock,
  getLogs,
  retryCount = EVENT_LOG_RETRY_COUNT,
  toBlock,
}: FetchLogsInBlockRangeInput<TLog>): Promise<TLog[]> {
  return fetchLogsInChunks({
    chunks: planLogChunks(fromBlock, toBlock, chunkSize),
    concurrency,
    getLogs,
    retryCount,
  });
}
