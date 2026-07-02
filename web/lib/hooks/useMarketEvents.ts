import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import { DEPLOY_BLOCK } from "@/lib/chain";
import { dedupeEvents, parseMarketLogs, type TradeEvent } from "@/lib/events";

const EVENT_REFETCH_INTERVAL_MS = 15_000;
const BLOCK_TIMESTAMP_CONCURRENCY = 8;

interface PopulateBlockTimestampCacheInput {
  blockNumbers: readonly bigint[];
  cache: Map<bigint, number>;
  concurrency?: number;
  getBlock: (blockNumber: bigint) => Promise<{ timestamp: bigint | number }>;
}

function eventQueryError(error: unknown): Error | undefined {
  if (!error) {
    return undefined;
  }

  return error instanceof Error ? error : new Error("Failed to load on-chain market events.");
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

  const query = useQuery({
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) {
        return [];
      }

      const logs = await publicClient.getLogs({
        address: [HADRON_ASSETS_ADDRESS, HADRON_MARKET_ADDRESS],
        fromBlock: BigInt(DEPLOY_BLOCK),
        toBlock: "latest",
      });
      const events = dedupeEvents(parseMarketLogs(logs));

      await populateBlockTimestampCache({
        blockNumbers: events.map((event) => event.blockNumber),
        cache: blockTimestampCache.current,
        getBlock: (blockNumber) => publicClient.getBlock({ blockNumber }),
      });

      return events.map((event) => ({
        ...event,
        timestamp: blockTimestampCache.current.get(event.blockNumber),
      }));
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
    events: query.data ?? [],
    isLoading: Boolean(publicClient) && query.isLoading,
    nowMs: query.dataUpdatedAt,
  };
}
