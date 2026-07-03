import type { Address, Hex } from "viem";
import type { TradeEvent } from "@/lib/events";

export const MARKET_EVENTS_CACHE_VERSION = 2;

export interface MarketEventsCacheData {
  events: TradeEvent[];
  lastScannedBlock: bigint;
}

interface MarketEventsCacheKeyInput {
  assetsAddress: Address | string;
  deployBlock: bigint | number;
  marketAddress: Address | string;
  yieldAddress: Address | string;
}

type SerializedTradeEvent = Omit<
  TradeEvent,
  | "amount"
  | "yieldAmount"
  | "blockNumber"
  | "listingId"
  | "offeringId"
  | "pricePerShare"
  | "tokenId"
  | "totalPaid"
> & {
  amount?: string;
  yieldAmount?: string;
  blockNumber: string;
  listingId?: string;
  offeringId?: string;
  pricePerShare?: string;
  tokenId: string;
  totalPaid?: string;
};

interface SerializedMarketEventsCache {
  events: SerializedTradeEvent[];
  lastScannedBlock: string;
  version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBigIntText(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function parseOptionalBigIntText(value: unknown): bigint | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return parseBigIntText(value);
}

function parseNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseOptionalNumber(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return parseNumber(value);
}

function parseHex(value: unknown): Hex | null {
  return typeof value === "string" && value.startsWith("0x") ? (value as Hex) : null;
}

function parseOptionalHex(value: unknown): Hex | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return parseHex(value);
}

function serializeBigInt(value: bigint | undefined): string | undefined {
  return value === undefined ? undefined : value.toString();
}

function serializeEvent(event: TradeEvent): SerializedTradeEvent {
  return {
    amount: serializeBigInt(event.amount),
    yieldAmount: serializeBigInt(event.yieldAmount),
    blockNumber: event.blockNumber.toString(),
    account: event.account,
    buyer: event.buyer,
    listingId: serializeBigInt(event.listingId),
    logIndex: event.logIndex,
    offeringId: serializeBigInt(event.offeringId),
    pricePerShare: serializeBigInt(event.pricePerShare),
    seller: event.seller,
    timestamp: event.timestamp,
    tokenId: event.tokenId.toString(),
    totalPaid: serializeBigInt(event.totalPaid),
    txHash: event.txHash,
    type: event.type,
  };
}

function deserializeEvent(raw: unknown): TradeEvent | null {
  if (!isRecord(raw)) {
    return null;
  }

  const blockNumber = parseBigIntText(raw.blockNumber);
  const tokenId = parseBigIntText(raw.tokenId);
  const txHash = parseHex(raw.txHash);
  const logIndex = parseNumber(raw.logIndex);

  if (blockNumber === null || tokenId === null || txHash === null || logIndex === null) {
    return null;
  }

  const amount = parseOptionalBigIntText(raw.amount);
  const yieldAmount = parseOptionalBigIntText(raw.yieldAmount);
  const account = parseOptionalHex(raw.account);
  const buyer = parseOptionalHex(raw.buyer);
  const listingId = parseOptionalBigIntText(raw.listingId);
  const offeringId = parseOptionalBigIntText(raw.offeringId);
  const pricePerShare = parseOptionalBigIntText(raw.pricePerShare);
  const seller = parseOptionalHex(raw.seller);
  const timestamp = parseOptionalNumber(raw.timestamp);
  const totalPaid = parseOptionalBigIntText(raw.totalPaid);

  if (
    amount === null ||
    yieldAmount === null ||
    account === null ||
    buyer === null ||
    listingId === null ||
    offeringId === null ||
    pricePerShare === null ||
    seller === null ||
    timestamp === null ||
    totalPaid === null
  ) {
    return null;
  }

  return {
    account,
    amount,
    blockNumber,
    buyer,
    listingId,
    logIndex,
    offeringId,
    pricePerShare,
    seller,
    timestamp,
    tokenId,
    totalPaid,
    txHash,
    type: raw.type as TradeEvent["type"],
    yieldAmount,
  };
}

function browserLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function marketEventsCacheKey({
  assetsAddress,
  deployBlock,
  marketAddress,
  yieldAddress,
}: MarketEventsCacheKeyInput): string {
  return [
    "hadron:market-events",
    `v${MARKET_EVENTS_CACHE_VERSION}`,
    assetsAddress.toLowerCase(),
    marketAddress.toLowerCase(),
    yieldAddress.toLowerCase(),
    deployBlock.toString(),
  ].join(":");
}

export function serializeMarketEventsCache(data: MarketEventsCacheData): string {
  const serialized: SerializedMarketEventsCache = {
    events: data.events.map(serializeEvent),
    lastScannedBlock: data.lastScannedBlock.toString(),
    version: MARKET_EVENTS_CACHE_VERSION,
  };

  return JSON.stringify(serialized);
}

export function deserializeMarketEventsCache(raw: string | null): MarketEventsCacheData | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!isRecord(parsed) || parsed.version !== MARKET_EVENTS_CACHE_VERSION) {
      return null;
    }

    const lastScannedBlock = parseBigIntText(parsed.lastScannedBlock);

    if (lastScannedBlock === null || !Array.isArray(parsed.events)) {
      return null;
    }

    const events = parsed.events.map(deserializeEvent);

    if (events.some((event) => event === null)) {
      return null;
    }

    return {
      events: events as TradeEvent[],
      lastScannedBlock,
    };
  } catch {
    return null;
  }
}

export function readMarketEventsCache(
  key: string,
  storage: Storage | null = browserLocalStorage(),
): MarketEventsCacheData | null {
  if (!storage) {
    return null;
  }

  try {
    return deserializeMarketEventsCache(storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeMarketEventsCache(
  key: string,
  data: MarketEventsCacheData,
  storage: Storage | null = browserLocalStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, serializeMarketEventsCache(data));
  } catch {
    // 浏览器配额或隐私模式失败时降级为内存查询。
  }
}
