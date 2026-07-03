import { decodeEventLog, type Abi, type Hex } from "viem";
import HadronAssetsAbi from "./abi/HadronAssets.json";
import HadronMarketAbi from "./abi/HadronMarket.json";

export type TradeEventType =
  | "primary-sale"
  | "purchased"
  | "listed"
  | "cancelled"
  | "asset-issued"
  | "offering-created"
  | "offering-closed";

export interface TradeEvent {
  type: TradeEventType;
  tokenId: bigint;
  amount?: bigint;
  buyer?: Hex;
  pricePerShare?: bigint;
  seller?: Hex;
  totalPaid?: bigint;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  timestamp?: number;
  listingId?: bigint;
  offeringId?: bigint;
}

export interface PricePoint {
  t: number;
  price: bigint;
}

export interface LogChunk {
  from: bigint;
  to: bigint;
}

interface RawMarketLog {
  args?: Record<string, unknown>;
  blockNumber?: bigint | number | null;
  data?: Hex;
  eventName?: string;
  logIndex?: number | bigint | null;
  timestamp?: number;
  topics?: readonly Hex[];
  transactionHash?: Hex | null;
  txHash?: Hex | null;
}

interface DecodedLog {
  eventName: string;
  args: Record<string, unknown>;
}

const EVENT_NAME_TO_TYPE: Record<string, TradeEventType> = {
  AssetIssued: "asset-issued",
  Cancelled: "cancelled",
  Listed: "listed",
  OfferingClosed: "offering-closed",
  OfferingCreated: "offering-created",
  PrimarySale: "primary-sale",
  Purchased: "purchased",
};

function isTrackedEventAbiItem(item: { type?: string; name?: string }): boolean {
  return item.type === "event" && typeof item.name === "string" && item.name in EVENT_NAME_TO_TYPE;
}

const MARKET_EVENT_ABI = [...HadronAssetsAbi, ...HadronMarketAbi].filter(isTrackedEventAbiItem) as Abi;

const TRADE_TYPES = new Set<TradeEventType>(["primary-sale", "purchased"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }

  return undefined;
}

function toAddress(value: unknown): Hex | undefined {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Hex)
    : undefined;
}

function txHashFor(log: RawMarketLog): Hex | undefined {
  return log.transactionHash ?? log.txHash ?? undefined;
}

function decodeMarketLog(log: RawMarketLog): DecodedLog | null {
  if (log.eventName && log.args) {
    return { args: log.args, eventName: log.eventName };
  }

  if (!log.data || !log.topics) {
    return null;
  }

  try {
    const topics = [...log.topics] as [] | [Hex, ...Hex[]];
    const decoded = decodeEventLog({
      abi: MARKET_EVENT_ABI,
      data: log.data,
      topics,
    });

    if (!decoded.eventName || !(decoded.eventName in EVENT_NAME_TO_TYPE)) {
      return null;
    }

    if (!decoded.args || Array.isArray(decoded.args)) {
      return null;
    }

    return {
      args: decoded.args as unknown as Record<string, unknown>,
      eventName: decoded.eventName,
    };
  } catch {
    return null;
  }
}

function priceFromTotal(totalPaid: bigint | undefined, amount: bigint | undefined): bigint | undefined {
  if (totalPaid === undefined || amount === undefined || amount === 0n) {
    return undefined;
  }

  return totalPaid / amount;
}

function logSortKey(event: Pick<TradeEvent, "blockNumber" | "logIndex">): [bigint, number] {
  return [event.blockNumber, event.logIndex];
}

function compareLogOrder(a: Pick<TradeEvent, "blockNumber" | "logIndex">, b: Pick<TradeEvent, "blockNumber" | "logIndex">) {
  const [aBlock, aLog] = logSortKey(a);
  const [bBlock, bLog] = logSortKey(b);

  if (aBlock === bBlock) {
    return aLog - bLog;
  }

  return aBlock > bBlock ? 1 : -1;
}

export function planLogChunks(fromBlock: bigint, toBlock: bigint, chunkSize: bigint): LogChunk[] {
  if (chunkSize <= 0n) {
    throw new Error("Log chunk size must be greater than zero.");
  }

  if (fromBlock > toBlock) {
    return [];
  }

  const chunks: LogChunk[] = [];
  let from = fromBlock;

  while (from <= toBlock) {
    const to = from + chunkSize - 1n;
    const boundedTo = to > toBlock ? toBlock : to;

    chunks.push({ from, to: boundedTo });
    from = boundedTo + 1n;
  }

  return chunks;
}

export function parseMarketLogs(logs: readonly RawMarketLog[]): TradeEvent[] {
  const listingTokenIds = new Map<bigint, bigint>();
  const offeringTokenIds = new Map<bigint, bigint>();
  const decodedLogs = logs
    .map((log) => ({ decoded: decodeMarketLog(log), log }))
    .filter((entry): entry is { decoded: DecodedLog; log: RawMarketLog } => entry.decoded !== null);

  for (const { decoded } of decodedLogs) {
    const tokenId = toBigInt(decoded.args.tokenId);

    if (decoded.eventName === "Listed") {
      const listingId = toBigInt(decoded.args.listingId);

      if (listingId !== undefined && tokenId !== undefined) {
        listingTokenIds.set(listingId, tokenId);
      }
    }

    if (decoded.eventName === "OfferingCreated") {
      const offeringId = toBigInt(decoded.args.offeringId);

      if (offeringId !== undefined && tokenId !== undefined) {
        offeringTokenIds.set(offeringId, tokenId);
      }
    }
  }

  const events: TradeEvent[] = [];

  for (const { decoded, log } of decodedLogs) {
    const txHash = txHashFor(log);
    const logIndex = toNumber(log.logIndex);
    const blockNumber = toBigInt(log.blockNumber);
    const type = EVENT_NAME_TO_TYPE[decoded.eventName];

    if (!txHash || logIndex === undefined || blockNumber === undefined || !type) {
      continue;
    }

    const args = decoded.args;
    const listingId = toBigInt(args.listingId);
    const offeringId = toBigInt(args.offeringId);
    const amount = toBigInt(args.amount ?? args.totalShares ?? args.returnedAmount);
    const buyer = toAddress(args.buyer);
    const seller = toAddress(args.seller);
    const totalPaid = toBigInt(args.totalPaid);
    const pricePerShare = toBigInt(args.pricePerShare) ?? priceFromTotal(totalPaid, amount);
    const tokenId =
      toBigInt(args.tokenId) ??
      (listingId !== undefined ? listingTokenIds.get(listingId) : undefined) ??
      (offeringId !== undefined ? offeringTokenIds.get(offeringId) : undefined);

    if (tokenId === undefined) {
      continue;
    }

    events.push({
      amount,
      blockNumber,
      buyer,
      listingId,
      logIndex,
      offeringId,
      pricePerShare,
      seller,
      timestamp: log.timestamp,
      tokenId,
      totalPaid,
      txHash,
      type,
    });
  }

  return events.sort(compareLogOrder);
}

export function dedupeEvents(events: readonly TradeEvent[]): TradeEvent[] {
  const seen = new Set<string>();
  const result: TradeEvent[] = [];

  for (const event of events) {
    const key = `${event.txHash}:${event.logIndex}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(event);
  }

  return result;
}

export function mergeTradeEvents(
  existingEvents: readonly TradeEvent[],
  incomingEvents: readonly TradeEvent[],
): TradeEvent[] {
  return dedupeEvents([...existingEvents, ...incomingEvents]).sort(compareLogOrder);
}

function tradePriceEvents(events: readonly TradeEvent[], tokenId: bigint): TradeEvent[] {
  return events
    .filter(
      (event) =>
        event.tokenId === tokenId &&
        TRADE_TYPES.has(event.type) &&
        event.pricePerShare !== undefined,
    )
    .sort((a, b) => {
      const aTime = a.timestamp ?? Number(a.blockNumber);
      const bTime = b.timestamp ?? Number(b.blockNumber);

      if (aTime === bTime) {
        return compareLogOrder(a, b);
      }

      return aTime - bTime;
    });
}

export function buildPriceSeries(
  events: readonly TradeEvent[],
  tokenId: bigint,
  fallbackPrice: bigint,
): PricePoint[] {
  const trades = tradePriceEvents(events, tokenId);

  if (trades.length < 2) {
    return [
      { price: fallbackPrice, t: 0 },
      { price: fallbackPrice, t: 1 },
    ];
  }

  return trades.map((event) => ({
    price: event.pricePerShare ?? fallbackPrice,
    t: event.timestamp ?? Number(event.blockNumber),
  }));
}

export function compute24h(
  events: readonly TradeEvent[],
  tokenId: bigint,
  fallbackPrice: bigint,
  nowMs: number,
): { changePct: number; volume: bigint } {
  const cutoff = nowMs - ONE_DAY_MS;
  const trades = tradePriceEvents(events, tokenId);
  let volume = 0n;

  for (const event of trades) {
    const timestamp = event.timestamp;

    if (
      timestamp !== undefined &&
      timestamp >= cutoff &&
      timestamp <= nowMs &&
      event.totalPaid !== undefined
    ) {
      volume += event.totalPaid;
    }
  }

  if (trades.length === 0) {
    return { changePct: 0, volume };
  }

  const latest = trades[trades.length - 1].pricePerShare ?? fallbackPrice;
  const baselineTrade = trades
    .filter((event) => event.timestamp !== undefined && event.timestamp <= cutoff)
    .at(-1);
  const baseline = baselineTrade?.pricePerShare ?? fallbackPrice;
  const changePct = baseline === 0n ? 0 : (Number(latest - baseline) / Number(baseline)) * 100;

  return { changePct, volume };
}
