import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import { DEPLOY_BLOCK } from "@/lib/chain";
import { fetchLogsInBlockRange } from "@/lib/eventLogs";
import {
  mergeTradeEvents,
  parseMarketLogs,
  type TradeEvent,
} from "@/lib/events";
import {
  marketEventsCacheKey,
  readMarketEventsCache,
  writeMarketEventsCache,
  type MarketEventsCacheData,
} from "@/lib/marketEventCache";

const EVENT_REFETCH_INTERVAL_MS = 15_000;
const BLOCK_TIMESTAMP_CONCURRENCY = 8;

type MarketLog = Parameters<typeof parseMarketLogs>[0][number];

interface PopulateBlockTimestampCacheInput {
  blockNumbers: readonly bigint[];
  cache: Map<bigint, number>;
  concurrency?: number;
  getBlock: (blockNumber: bigint) => Promise<{ timestamp: bigint | number }>;
}

type MarketEventsQueryData = MarketEventsCacheData;

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
  const cacheKey = marketEventsCacheKey({
    assetsAddress: HADRON_ASSETS_ADDRESS,
    deployBlock: DEPLOY_BLOCK,
    marketAddress: HADRON_MARKET_ADDRESS,
  });
  const [initialData] = useState<MarketEventsQueryData | null>(() =>
    readMarketEventsCache(cacheKey),
  );
  const blockTimestampCache = useRef(
    new Map<bigint, number>(
      (initialData?.events ?? []).flatMap((event) =>
        event.timestamp === undefined ? [] : [[event.blockNumber, event.timestamp]],
      ),
    ),
  );
  const queryDataRef = useRef<MarketEventsQueryData | null>(initialData);

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

      if (fromBlock > latestBlock) {
        const data = previousData ?? {
          events: [],
          lastScannedBlock: BigInt(DEPLOY_BLOCK) - 1n,
        };

        queryDataRef.current = data;
        return data;
      }

      const logs = await fetchLogsInBlockRange<MarketLog>({
        fromBlock,
        getLogs: async (chunk) => {
          const logs = await publicClient.getLogs({
            address: [HADRON_ASSETS_ADDRESS, HADRON_MARKET_ADDRESS],
            fromBlock: chunk.from,
            toBlock: chunk.to,
          });

          return logs as readonly MarketLog[];
        },
        toBlock: latestBlock,
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
      writeMarketEventsCache(cacheKey, data);
      return data;
    },
    initialData: initialData ?? undefined,
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
