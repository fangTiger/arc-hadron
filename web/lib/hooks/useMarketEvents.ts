import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import { DEPLOY_BLOCK } from "@/lib/chain";
import {
  mergeTradeEvents,
  parseMarketLogs,
  planLogChunks,
  type LogChunk,
  type TradeEvent,
} from "@/lib/events";

const EVENT_REFETCH_INTERVAL_MS = 15_000;
const BLOCK_TIMESTAMP_CONCURRENCY = 8;
const EVENT_LOG_CHUNK_SIZE = 9_000n;
const EVENT_LOG_CONCURRENCY = 4;
const EVENT_LOG_RETRY_COUNT = 1;

type MarketLog = Parameters<typeof parseMarketLogs>[0][number];

interface PopulateBlockTimestampCacheInput {
  blockNumbers: readonly bigint[];
  cache: Map<bigint, number>;
  concurrency?: number;
  getBlock: (blockNumber: bigint) => Promise<{ timestamp: bigint | number }>;
}

interface MarketEventsQueryData {
  events: TradeEvent[];
  lastScannedBlock: bigint;
}

interface FetchMarketLogsInput {
  chunks: readonly LogChunk[];
  concurrency?: number;
  getLogs: (chunk: LogChunk) => Promise<readonly MarketLog[]>;
  retryCount?: number;
}

interface ChunkLogsResult {
  failed: boolean;
  logs: readonly MarketLog[];
}

function eventQueryError(error: unknown): Error | undefined {
  if (!error) {
    return undefined;
  }

  return error instanceof Error ? error : new Error("Failed to load on-chain market events.");
}

function warnSkippedLogChunk(chunk: LogChunk, error: unknown): void {
  console.warn(
    `Failed to load market logs for block range ${chunk.from.toString()}-${chunk.to.toString()}; skipping.`,
    error,
  );
}

async function getChunkLogsWithRetry(
  chunk: LogChunk,
  getLogs: (chunk: LogChunk) => Promise<readonly MarketLog[]>,
  retryCount: number,
): Promise<ChunkLogsResult> {
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

async function fetchMarketLogsInChunks({
  chunks,
  concurrency = EVENT_LOG_CONCURRENCY,
  getLogs,
  retryCount = EVENT_LOG_RETRY_COUNT,
}: FetchMarketLogsInput): Promise<MarketLog[]> {
  if (chunks.length === 0) {
    return [];
  }

  const workerCount = Math.min(Math.max(1, concurrency), chunks.length);
  const results: MarketLog[][] = Array.from({ length: chunks.length }, () => []);
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

export async function populateBlockTimestampCache({
  blockNumbers,
  cache,
  concurrency = BLOCK_TIMESTAMP_CONCURRENCY,
  getBlock,
}: PopulateBlockTimestampCacheInput): Promise<void> {
  const missingBlocks = Array.from(new Set(blockNumbers)).filter(
    (blockNumber) => !cache.has(blockNumber),
  );
  const workerCount = Math.min(Math.max(1, concurrency), missingBlocks.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < missingBlocks.length) {
        const blockNumber = missingBlocks[nextIndex];
        nextIndex += 1;

        const block = await getBlock(blockNumber);
        cache.set(blockNumber, Number(block.timestamp) * 1000);
      }
    }),
  );
}

export function useMarketEvents(): {
  events: TradeEvent[];
  isLoading: boolean;
  error?: Error;
  nowMs: number;
} {
  const publicClient = usePublicClient();
  const blockTimestampCache = useRef(new Map<bigint, number>());
  const queryDataRef = useRef<MarketEventsQueryData | null>(null);

  const query = useQuery({
    enabled: Boolean(publicClient),
    queryFn: async (): Promise<MarketEventsQueryData> => {
      if (!publicClient) {
        return { events: [], lastScannedBlock: BigInt(DEPLOY_BLOCK) - 1n };
      }

      const previousData = queryDataRef.current;
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = previousData
        ? previousData.lastScannedBlock + 1n
        : BigInt(DEPLOY_BLOCK);
      const chunks = planLogChunks(fromBlock, latestBlock, EVENT_LOG_CHUNK_SIZE);

      if (chunks.length === 0) {
        const data = previousData ?? {
          events: [],
          lastScannedBlock: BigInt(DEPLOY_BLOCK) - 1n,
        };

        queryDataRef.current = data;
        return data;
      }

      const logs = await fetchMarketLogsInChunks({
        chunks,
        getLogs: async (chunk) => {
          const logs = await publicClient.getLogs({
            address: [HADRON_ASSETS_ADDRESS, HADRON_MARKET_ADDRESS],
            fromBlock: chunk.from,
            toBlock: chunk.to,
          });

          return logs as readonly MarketLog[];
        },
      });
      const events = mergeTradeEvents(previousData?.events ?? [], parseMarketLogs(logs));

      await populateBlockTimestampCache({
        blockNumbers: events.map((event) => event.blockNumber),
        cache: blockTimestampCache.current,
        getBlock: (blockNumber) => publicClient.getBlock({ blockNumber }),
      });

      const data = {
        events: events.map((event) => ({
          ...event,
          timestamp: blockTimestampCache.current.get(event.blockNumber),
        })),
        lastScannedBlock: latestBlock,
      };

      queryDataRef.current = data;
      return data;
    },
    queryKey: [
      "market-events",
      HADRON_ASSETS_ADDRESS,
      HADRON_MARKET_ADDRESS,
      DEPLOY_BLOCK,
    ],
    refetchInterval: EVENT_REFETCH_INTERVAL_MS,
  });

  return {
    error: eventQueryError(query.error),
    events: query.data?.events ?? [],
    isLoading: Boolean(publicClient) && query.isLoading,
    nowMs: query.dataUpdatedAt,
  };
}
