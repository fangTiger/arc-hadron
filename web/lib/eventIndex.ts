import type { Address } from "viem";
import { ARC_CHAIN_ID, DEPLOY_BLOCK } from "@/lib/chain";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "@/lib/contracts";
import { fetchLogsInBlockRange } from "@/lib/eventLogs";
import { parseMarketLogs, type TradeEvent } from "@/lib/events";

export type EventIndexLog = Parameters<typeof parseMarketLogs>[0][number];

export interface EventIndexClient {
  getBlockNumber(): Promise<bigint>;
  getLogs(input: {
    address: readonly Address[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<readonly EventIndexLog[]>;
}

export interface EventIndexStatus {
  cachedEvents: number;
  chainId: number;
  indexedBlock: bigint | null;
  lagBlocks: bigint | null;
  lastError: string | null;
  lastIndexedAt: string | null;
  latestBlock: bigint | null;
}

interface EventIndexState {
  eventsByKey: Map<string, TradeEvent>;
  indexedBlock: bigint | null;
  lastError: string | null;
  lastIndexedAt: string | null;
  latestBlock: bigint | null;
}

const EVENT_ADDRESSES = [
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
] as const;

const state: EventIndexState = {
  eventsByKey: new Map(),
  indexedBlock: null,
  lastError: null,
  lastIndexedAt: null,
  latestBlock: null,
};

function eventKey(event: Pick<TradeEvent, "logIndex" | "txHash">): string {
  return `${ARC_CHAIN_ID}:${event.txHash}:${event.logIndex}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cachedEvents(): TradeEvent[] {
  return Array.from(state.eventsByKey.values());
}

function lagBlocks(): bigint | null {
  if (state.latestBlock === null || state.indexedBlock === null) {
    return null;
  }

  return state.latestBlock > state.indexedBlock ? state.latestBlock - state.indexedBlock : 0n;
}

export function getEventIndexStatus(): EventIndexStatus {
  return {
    cachedEvents: state.eventsByKey.size,
    chainId: ARC_CHAIN_ID,
    indexedBlock: state.indexedBlock,
    lagBlocks: lagBlocks(),
    lastError: state.lastError,
    lastIndexedAt: state.lastIndexedAt,
    latestBlock: state.latestBlock,
  };
}

export async function loadEventIndexStatus({
  client,
}: {
  client: EventIndexClient;
}): Promise<EventIndexStatus> {
  state.latestBlock = await client.getBlockNumber();

  return getEventIndexStatus();
}

export async function loadIndexedMarketEvents({
  client,
}: {
  client: EventIndexClient;
}): Promise<TradeEvent[]> {
  const latestBlock = await client.getBlockNumber();
  state.latestBlock = latestBlock;

  if (latestBlock < BigInt(DEPLOY_BLOCK)) {
    state.indexedBlock = latestBlock;
    state.lastError = null;
    state.lastIndexedAt = new Date().toISOString();

    return cachedEvents();
  }

  const fromBlock =
    state.indexedBlock === null ? BigInt(DEPLOY_BLOCK) : state.indexedBlock + 1n;

  if (fromBlock > latestBlock) {
    state.lastError = null;
    return cachedEvents();
  }

  try {
    const logs = await fetchLogsInBlockRange<EventIndexLog>({
      fromBlock,
      getLogs: async (chunk) =>
        client.getLogs({
          address: EVENT_ADDRESSES,
          fromBlock: chunk.from,
          toBlock: chunk.to,
        }),
      toBlock: latestBlock,
    });

    for (const event of parseMarketLogs(logs)) {
      state.eventsByKey.set(eventKey(event), event);
    }

    state.indexedBlock = latestBlock;
    state.lastError = null;
    state.lastIndexedAt = new Date().toISOString();

    return cachedEvents();
  } catch (error) {
    state.lastError = errorMessage(error);

    if (state.indexedBlock !== null) {
      return cachedEvents();
    }

    throw error;
  }
}

export function resetEventIndexForTest(): void {
  state.eventsByKey.clear();
  state.indexedBlock = null;
  state.lastError = null;
  state.lastIndexedAt = null;
  state.latestBlock = null;
}
