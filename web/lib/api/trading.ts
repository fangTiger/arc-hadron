import { encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import { ARC_CHAIN_ID, ARC_EXPLORER_URL } from "@/lib/chain";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { getPublicQueryClient, type PublicQueryClient } from "@/lib/api/publicQuery";

export interface TradingApiClient extends PublicQueryClient {
  getTransactionReceipt(input: { hash: Hex }): Promise<TransactionReceiptLike | null>;
  sendRawTransaction(input: { serializedTransaction: Hex }): Promise<Hex>;
}

export class TradingInputError extends Error {}

type MarketFunctionName = "buy" | "cancel" | "cancelBid" | "fillBid" | "list" | "placeBid";

type PreparedArgs = Record<string, string>;

interface PreparePayloadInput {
  approvalRequired: boolean;
  args: readonly bigint[];
  fields: PreparedArgs;
  functionName: MarketFunctionName;
  idempotencyKey?: string;
  value: bigint;
  extra?: Record<string, string | boolean>;
}

interface MarketListing {
  active: boolean;
  pricePerShare: bigint;
  remaining: bigint;
  seller: Address;
  tokenId: bigint;
}

interface MarketBid {
  active: boolean;
  bidder: Address;
  pricePerShare: bigint;
  remaining: bigint;
  tokenId: bigint;
}

interface TransactionReceiptLike {
  blockNumber?: bigint;
  contractAddress?: Address | null;
  from?: Address;
  gasUsed?: bigint;
  status?: "success" | "reverted";
  to?: Address | null;
  transactionHash?: Hex;
}

export interface PreparedTransactionPayload {
  data: {
    approvalRequired: boolean;
    args: PreparedArgs;
    calldata: Hex;
    chainId: number;
    contract: "HADRON_MARKET";
    functionName: MarketFunctionName;
    idempotencyKey?: string;
    to: Address;
    value: string;
  } & Record<string, string | boolean | PreparedArgs | Hex | number | undefined>;
  meta: {
    chainId: number;
    contract: Address;
  };
}

function tradingClient(client?: TradingApiClient): TradingApiClient {
  return client ?? (getPublicQueryClient() as TradingApiClient);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TradingInputError("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

function parsePositiveBigIntString(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new TradingInputError(`${name} must be a positive integer string.`);
  }

  return BigInt(value);
}

function parseIdempotencyKey(record: Record<string, unknown>): string | undefined {
  const value = record.idempotencyKey;

  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > 120 ||
    !/^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    throw new TradingInputError("idempotencyKey must be 1-120 URL-safe characters.");
  }

  return value;
}

function parseOrderType(value: unknown): "bid" | "listing" {
  if (value !== "bid" && value !== "listing") {
    throw new TradingInputError("orderType must be listing or bid.");
  }

  return value;
}

function parseHexString(value: unknown, name: string): Hex {
  if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value)) {
    throw new TradingInputError(`${name} must be a 0x-prefixed hex string.`);
  }

  return value as Hex;
}

function parseTransactionHash(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new TradingInputError("txHash must be a 32-byte 0x transaction hash.");
  }

  return value as Hex;
}

function explorerTxUrl(txHash: Hex): string {
  return `${ARC_EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`;
}

function bigintFields(fields: Record<string, bigint | string>): PreparedArgs {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      typeof value === "bigint" ? value.toString() : value,
    ]),
  );
}

function preparePayload({
  approvalRequired,
  args,
  extra,
  fields,
  functionName,
  idempotencyKey,
  value,
}: PreparePayloadInput): PreparedTransactionPayload {
  const calldata = encodeFunctionData({
    abi: HADRON_MARKET_ABI,
    args,
    functionName,
  });

  return {
    data: {
      approvalRequired,
      args: fields,
      calldata,
      chainId: ARC_CHAIN_ID,
      contract: "HADRON_MARKET",
      functionName,
      idempotencyKey,
      to: HADRON_MARKET_ADDRESS,
      value: value.toString(),
      ...extra,
    },
    meta: {
      chainId: ARC_CHAIN_ID,
      contract: HADRON_MARKET_ADDRESS,
    },
  };
}

function tupleField(raw: unknown, key: string, index: number): unknown {
  if (typeof raw === "object" && raw !== null && key in raw) {
    return (raw as Record<string, unknown>)[key];
  }

  if (Array.isArray(raw)) {
    return raw[index];
  }

  return undefined;
}

function requireAddress(value: unknown, label: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} must be an address.`);
  }

  return value;
}

function requireBigInt(value: unknown, label: string): bigint {
  if (typeof value !== "bigint") {
    throw new Error(`${label} must be a bigint.`);
  }

  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function normalizeListing(raw: unknown): MarketListing {
  return {
    active: requireBoolean(tupleField(raw, "active", 4), "listing.active"),
    pricePerShare: requireBigInt(tupleField(raw, "pricePerShare", 2), "listing.pricePerShare"),
    remaining: requireBigInt(tupleField(raw, "remaining", 3), "listing.remaining"),
    seller: requireAddress(tupleField(raw, "seller", 0), "listing.seller"),
    tokenId: requireBigInt(tupleField(raw, "tokenId", 1), "listing.tokenId"),
  };
}

function normalizeBid(raw: unknown): MarketBid {
  return {
    active: requireBoolean(tupleField(raw, "active", 4), "bid.active"),
    bidder: requireAddress(tupleField(raw, "bidder", 0), "bid.bidder"),
    pricePerShare: requireBigInt(tupleField(raw, "pricePerShare", 2), "bid.pricePerShare"),
    remaining: requireBigInt(tupleField(raw, "remaining", 3), "bid.remaining"),
    tokenId: requireBigInt(tupleField(raw, "tokenId", 1), "bid.tokenId"),
  };
}

async function readListing(client: TradingApiClient, listingId: bigint): Promise<MarketListing> {
  const raw = await client.readContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "getListing",
    args: [listingId],
  });

  return normalizeListing(raw);
}

async function readBid(client: TradingApiClient, bidId: bigint): Promise<MarketBid> {
  const raw = await client.readContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "getBid",
    args: [bidId],
  });

  return normalizeBid(raw);
}

export async function prepareListingPayload(body: unknown): Promise<PreparedTransactionPayload> {
  const record = asRecord(body);
  const tokenId = parsePositiveBigIntString(record.tokenId, "tokenId");
  const amount = parsePositiveBigIntString(record.amount, "amount");
  const pricePerShare = parsePositiveBigIntString(record.pricePerShare, "pricePerShare");

  return preparePayload({
    approvalRequired: true,
    args: [tokenId, amount, pricePerShare],
    fields: bigintFields({ amount, pricePerShare, tokenId }),
    functionName: "list",
    idempotencyKey: parseIdempotencyKey(record),
    value: 0n,
  });
}

export async function prepareBidPayload(body: unknown): Promise<PreparedTransactionPayload> {
  const record = asRecord(body);
  const tokenId = parsePositiveBigIntString(record.tokenId, "tokenId");
  const amount = parsePositiveBigIntString(record.amount, "amount");
  const pricePerShare = parsePositiveBigIntString(record.pricePerShare, "pricePerShare");

  return preparePayload({
    approvalRequired: false,
    args: [tokenId, amount, pricePerShare],
    fields: bigintFields({ amount, pricePerShare, tokenId }),
    functionName: "placeBid",
    idempotencyKey: parseIdempotencyKey(record),
    value: amount * pricePerShare,
  });
}

export async function prepareBuyListingPayload({
  body,
  client,
  listingId,
}: {
  body: unknown;
  client?: TradingApiClient;
  listingId: unknown;
}): Promise<PreparedTransactionPayload> {
  const record = asRecord(body);
  const id = parsePositiveBigIntString(listingId, "listingId");
  const amount = parsePositiveBigIntString(record.amount, "amount");
  const listing = await readListing(tradingClient(client), id);

  if (!listing.active || listing.remaining <= 0n) {
    throw new TradingInputError("listingId is not active.");
  }

  if (amount > listing.remaining) {
    throw new TradingInputError("amount exceeds listing remaining shares.");
  }

  return preparePayload({
    approvalRequired: false,
    args: [id, amount],
    extra: bigintFields({
      pricePerShare: listing.pricePerShare,
      remaining: listing.remaining,
      tokenId: listing.tokenId,
    }),
    fields: bigintFields({ amount, listingId: id }),
    functionName: "buy",
    idempotencyKey: parseIdempotencyKey(record),
    value: amount * listing.pricePerShare,
  });
}

export async function prepareFillBidPayload({
  bidId,
  body,
  client,
}: {
  bidId: unknown;
  body: unknown;
  client?: TradingApiClient;
}): Promise<PreparedTransactionPayload> {
  const record = asRecord(body);
  const id = parsePositiveBigIntString(bidId, "bidId");
  const amount = parsePositiveBigIntString(record.amount, "amount");
  const bid = await readBid(tradingClient(client), id);

  if (!bid.active || bid.remaining <= 0n) {
    throw new TradingInputError("bidId is not active.");
  }

  if (amount > bid.remaining) {
    throw new TradingInputError("amount exceeds bid remaining shares.");
  }

  return preparePayload({
    approvalRequired: true,
    args: [id, amount],
    extra: bigintFields({
      pricePerShare: bid.pricePerShare,
      remaining: bid.remaining,
      tokenId: bid.tokenId,
    }),
    fields: bigintFields({ amount, bidId: id }),
    functionName: "fillBid",
    idempotencyKey: parseIdempotencyKey(record),
    value: 0n,
  });
}

export async function prepareCancelPayload(body: unknown): Promise<PreparedTransactionPayload> {
  const record = asRecord(body);
  const orderType = parseOrderType(record.orderType);
  const orderId = parsePositiveBigIntString(record.orderId, "orderId");
  const functionName = orderType === "listing" ? "cancel" : "cancelBid";

  return preparePayload({
    approvalRequired: false,
    args: [orderId],
    fields: bigintFields({ orderId, orderType }),
    functionName,
    idempotencyKey: parseIdempotencyKey(record),
    value: 0n,
  });
}

export async function broadcastSignedTransactionPayload(
  body: unknown,
  { client }: { client?: TradingApiClient } = {},
) {
  const record = asRecord(body);
  const signedTx = parseHexString(record.signedTx, "signedTx");
  const txHash = await tradingClient(client).sendRawTransaction({ serializedTransaction: signedTx });

  return {
    data: {
      explorerUrl: explorerTxUrl(txHash),
      idempotencyKey: parseIdempotencyKey(record),
      status: "submitted",
      txHash,
    },
  };
}

function isReceiptNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /receipt.*not found|not found.*receipt/i.test(`${error.name} ${error.message}`);
}

function pendingStatus(txHash: Hex) {
  return {
    data: {
      explorerUrl: explorerTxUrl(txHash),
      status: "pending",
      txHash,
    },
  };
}

function optionalBigInt(value: bigint | undefined): string | undefined {
  return value === undefined ? undefined : value.toString();
}

export async function loadTransactionStatusPayload({
  client,
  txHash,
}: {
  client?: TradingApiClient;
  txHash: unknown;
}) {
  const hash = parseTransactionHash(txHash);
  let receipt: TransactionReceiptLike | null;

  try {
    receipt = await tradingClient(client).getTransactionReceipt({ hash });
  } catch (error) {
    if (isReceiptNotFound(error)) {
      return pendingStatus(hash);
    }

    throw error;
  }

  if (!receipt) {
    return pendingStatus(hash);
  }

  return {
    data: {
      blockNumber: optionalBigInt(receipt.blockNumber),
      contractAddress: receipt.contractAddress ?? undefined,
      explorerUrl: explorerTxUrl(hash),
      from: receipt.from,
      gasUsed: optionalBigInt(receipt.gasUsed),
      status: receipt.status ?? "pending",
      to: receipt.to ?? undefined,
      txHash: receipt.transactionHash ?? hash,
    },
  };
}
