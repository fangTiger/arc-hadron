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

function eventQueryError(error: unknown): Error | undefined {
  if (!error) {
    return undefined;
  }

  return error instanceof Error ? error : new Error("Failed to load on-chain market events.");
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
      const missingBlocks = Array.from(new Set(events.map((event) => event.blockNumber))).filter(
        (blockNumber) => !blockTimestampCache.current.has(blockNumber),
      );

      await Promise.all(
        missingBlocks.map(async (blockNumber) => {
          const block = await publicClient.getBlock({ blockNumber });
          blockTimestampCache.current.set(blockNumber, Number(block.timestamp) * 1000);
        }),
      );

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
