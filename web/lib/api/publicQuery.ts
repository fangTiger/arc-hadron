import { createPublicClient, http, type Abi, type Address } from "viem";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, DEPLOY_BLOCK, FIRST_ACTIVE_TOKEN_ID } from "@/lib/chain";
import {
  HADRON_ASSETS_ABI,
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ABI,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "@/lib/contracts";
import { fetchLogsInBlockRange } from "@/lib/eventLogs";
import { mapBidResults } from "@/lib/bids";
import { mapListingResults } from "@/lib/listing";
import { joinAssetsWithOfferings, type ChainAsset, type ChainOffering } from "@/lib/mappers";
import { metaBySlug } from "@/lib/metadata";
import { parseMarketLogs, type TradeEvent, type TradeEventType } from "@/lib/events";

type MarketLog = Parameters<typeof parseMarketLogs>[0][number];

export interface PublicQueryClient {
  getBlock(input: { blockNumber: bigint }): Promise<{ timestamp: bigint | number }>;
  getBlockNumber(): Promise<bigint>;
  getLogs(input: {
    address: readonly Address[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<readonly MarketLog[]>;
  readContract(input: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
}

export interface QueryFilter {
  tokenId?: bigint;
}

export interface ListingQueryFilter extends QueryFilter {
  seller?: Address;
}

export interface BidQueryFilter extends QueryFilter {
  bidder?: Address;
}

export interface TradeQueryFilter extends QueryFilter {
  limit?: number;
  type?: TradeEventType;
}

interface LoadOptions {
  client?: PublicQueryClient;
}

type RawAsset = readonly [string, string, bigint, string] & {
  name?: string;
  category?: string;
  totalShares?: bigint;
  metadataURI?: string;
};

type RawOffering = readonly [bigint, bigint, bigint, boolean] & {
  tokenId?: bigint;
  pricePerShare?: bigint;
  remaining?: bigint;
  active?: boolean;
};

let defaultClient: PublicQueryClient | null = null;

export function getPublicQueryClient(): PublicQueryClient {
  if (!defaultClient) {
    defaultClient = createPublicClient({
      chain: arcTestnet,
      transport: http(ARC_RPC_URL, { batch: true }),
    }) as PublicQueryClient;
  }

  return defaultClient;
}

function activeClient(client?: PublicQueryClient): PublicQueryClient {
  return client ?? getPublicQueryClient();
}

function asSafeCount(value: unknown, label: string): number {
  if (typeof value !== "bigint") {
    throw new Error(`${label} must be returned as a bigint.`);
  }

  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the API safe range.`);
  }

  return Number(value);
}

function normalizeAsset(tokenId: bigint, raw: unknown): ChainAsset {
  const asset = raw as RawAsset;

  return {
    tokenId,
    name: asset.name ?? asset[0],
    category: asset.category ?? asset[1],
    totalShares: asset.totalShares ?? asset[2],
    metadataURI: asset.metadataURI ?? asset[3],
  };
}

function normalizeOffering(id: bigint, raw: unknown): ChainOffering {
  const offering = raw as RawOffering;

  return {
    id,
    tokenId: offering.tokenId ?? offering[0],
    pricePerShare: offering.pricePerShare ?? offering[1],
    remaining: offering.remaining ?? offering[2],
    active: offering.active ?? offering[3],
  };
}

function activeTokenIdsFor(assetCount: number): bigint[] {
  const first = Number(FIRST_ACTIVE_TOKEN_ID);

  if (assetCount < first) {
    return [];
  }

  return Array.from({ length: assetCount - first + 1 }, (_, index) => BigInt(first + index));
}

function idsForCount(count: number): bigint[] {
  return Array.from({ length: count }, (_, index) => BigInt(index + 1));
}

function sameAddress(a?: Address, b?: Address): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function serializeOffering(offering: ChainOffering | null) {
  return offering
    ? {
        active: offering.active,
        id: offering.id.toString(),
        pricePerShare: offering.pricePerShare.toString(),
        remaining: offering.remaining.toString(),
        tokenId: offering.tokenId.toString(),
      }
    : null;
}

function serializeAsset(view: ReturnType<typeof joinAssetsWithOfferings>[number]) {
  return {
    category: view.category,
    meta: {
      apyBps: view.meta.apyBps,
      description: view.meta.description,
      displayName: view.meta.displayName,
      docs: view.meta.docs,
      issuer: view.meta.issuer,
      issuerSlug: view.meta.issuerSlug,
      slug: view.meta.slug,
      ticker: view.meta.ticker,
    },
    name: view.name,
    offering: serializeOffering(view.offering),
    tokenId: view.tokenId.toString(),
    totalShares: view.totalShares.toString(),
  };
}

function serializeListing(listing: ReturnType<typeof mapListingResults>[number]) {
  return {
    id: listing.id.toString(),
    isMine: listing.isMine,
    pricePerShare: listing.pricePerShare.toString(),
    remaining: listing.remaining.toString(),
    seller: listing.seller,
    tokenId: listing.tokenId.toString(),
  };
}

function serializeBid(bid: ReturnType<typeof mapBidResults>[number]) {
  return {
    active: bid.active,
    bidder: bid.bidder,
    id: bid.id.toString(),
    isOwn: bid.isOwn,
    pricePerShare: bid.pricePerShare.toString(),
    remaining: bid.remaining.toString(),
    tokenId: bid.tokenId.toString(),
  };
}

function optionalBigInt(value: bigint | undefined): string | undefined {
  return value === undefined ? undefined : value.toString();
}

function serializeTrade(event: TradeEvent) {
  return {
    account: event.account,
    amount: optionalBigInt(event.amount),
    bidId: optionalBigInt(event.bidId),
    blockNumber: event.blockNumber.toString(),
    buyer: event.buyer,
    listingId: optionalBigInt(event.listingId),
    logIndex: event.logIndex,
    offeringId: optionalBigInt(event.offeringId),
    pricePerShare: optionalBigInt(event.pricePerShare),
    seller: event.seller,
    timestamp: event.timestamp,
    tokenId: event.tokenId.toString(),
    totalPaid: optionalBigInt(event.totalPaid),
    txHash: event.txHash,
    type: event.type,
    yieldAmount: optionalBigInt(event.yieldAmount),
  };
}

async function readCount(client: PublicQueryClient, contract: {
  address: Address;
  abi: Abi;
  functionName: string;
}) {
  const value = await client.readContract(contract);

  return asSafeCount(value, contract.functionName);
}

async function readMany(
  client: PublicQueryClient,
  contract: { address: Address; abi: Abi; functionName: string },
  ids: readonly bigint[],
) {
  return Promise.all(
    ids.map((id) =>
      client.readContract({
        ...contract,
        args: [id],
      }),
    ),
  );
}

export async function loadAssetsPayload({ client }: LoadOptions = {}) {
  const queryClient = activeClient(client);
  const [assetCount, offeringCount] = await Promise.all([
    readCount(queryClient, {
      address: HADRON_ASSETS_ADDRESS,
      abi: HADRON_ASSETS_ABI,
      functionName: "assetCount",
    }),
    readCount(queryClient, {
      address: HADRON_MARKET_ADDRESS,
      abi: HADRON_MARKET_ABI,
      functionName: "offeringCount",
    }),
  ]);
  const tokenIds = activeTokenIdsFor(assetCount);
  const offeringIds = idsForCount(offeringCount);
  const [rawAssets, rawOfferings] = await Promise.all([
    readMany(
      queryClient,
      {
        address: HADRON_ASSETS_ADDRESS,
        abi: HADRON_ASSETS_ABI,
        functionName: "getAsset",
      },
      tokenIds,
    ),
    readMany(
      queryClient,
      {
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getOffering",
      },
      offeringIds,
    ),
  ]);
  const assets = rawAssets.map((asset, index) => normalizeAsset(tokenIds[index], asset));
  const offerings = rawOfferings.map((offering, index) =>
    normalizeOffering(offeringIds[index], offering),
  );

  return {
    data: joinAssetsWithOfferings(assets, offerings, metaBySlug).map(serializeAsset),
    meta: {
      chainId: ARC_CHAIN_ID,
      contracts: {
        assets: HADRON_ASSETS_ADDRESS,
        market: HADRON_MARKET_ADDRESS,
      },
    },
  };
}

export async function loadListingsPayload({
  client,
  seller,
  tokenId,
}: LoadOptions & ListingQueryFilter = {}) {
  const queryClient = activeClient(client);
  const listingCount = await readCount(queryClient, {
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "listingCount",
  });
  const ids = idsForCount(listingCount);
  const rawListings = await readMany(
    queryClient,
    {
      address: HADRON_MARKET_ADDRESS,
      abi: HADRON_MARKET_ABI,
      functionName: "getListing",
    },
    ids,
  );
  const listings = mapListingResults({
    currentAddress: seller,
    ids,
    results: rawListings,
  }).filter((listing) => {
    if (tokenId !== undefined && listing.tokenId !== tokenId) {
      return false;
    }

    if (seller !== undefined && !sameAddress(listing.seller, seller)) {
      return false;
    }

    return true;
  });

  return {
    data: listings.map(serializeListing),
    meta: {
      chainId: ARC_CHAIN_ID,
      count: listings.length,
    },
  };
}

export async function loadBidsPayload({
  bidder,
  client,
  tokenId,
}: LoadOptions & BidQueryFilter = {}) {
  const queryClient = activeClient(client);
  const bidCount = await readCount(queryClient, {
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "bidCount",
  });
  const ids = idsForCount(bidCount);
  const rawBids = await readMany(
    queryClient,
    {
      address: HADRON_MARKET_ADDRESS,
      abi: HADRON_MARKET_ABI,
      functionName: "getBid",
    },
    ids,
  );
  const bids = mapBidResults({
    currentAddress: bidder,
    ids,
    results: rawBids,
  }).filter((bid) => {
    if (tokenId !== undefined && bid.tokenId !== tokenId) {
      return false;
    }

    if (bidder !== undefined && !sameAddress(bid.bidder, bidder)) {
      return false;
    }

    return true;
  });

  return {
    data: bids.map(serializeBid),
    meta: {
      chainId: ARC_CHAIN_ID,
      count: bids.length,
    },
  };
}

async function timestampsFor(client: PublicQueryClient, events: readonly TradeEvent[]) {
  const timestamps = new Map<bigint, number>();
  const blockNumbers = Array.from(new Set(events.map((event) => event.blockNumber)));

  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      timestamps.set(blockNumber, Number(block.timestamp) * 1000);
    }),
  );

  return timestamps;
}

function compareRecentEvents(a: TradeEvent, b: TradeEvent): number {
  if (a.blockNumber === b.blockNumber) {
    return b.logIndex - a.logIndex;
  }

  return a.blockNumber > b.blockNumber ? -1 : 1;
}

export async function loadTradesPayload({
  client,
  limit = 50,
  tokenId,
  type,
}: LoadOptions & TradeQueryFilter = {}) {
  const queryClient = activeClient(client);
  const latestBlock = await queryClient.getBlockNumber();

  if (latestBlock < BigInt(DEPLOY_BLOCK)) {
    return {
      data: [],
      meta: {
        chainId: ARC_CHAIN_ID,
        latestBlock: latestBlock.toString(),
      },
    };
  }

  const logs = await fetchLogsInBlockRange<MarketLog>({
    fromBlock: BigInt(DEPLOY_BLOCK),
    getLogs: async (chunk) =>
      queryClient.getLogs({
        address: [HADRON_ASSETS_ADDRESS, HADRON_MARKET_ADDRESS, HADRON_YIELD_ADDRESS],
        fromBlock: chunk.from,
        toBlock: chunk.to,
      }),
    toBlock: latestBlock,
  });
  const events = parseMarketLogs(logs)
    .filter((event) => event.tokenId >= FIRST_ACTIVE_TOKEN_ID)
    .filter((event) => (tokenId === undefined ? true : event.tokenId === tokenId))
    .filter((event) => (type === undefined ? true : event.type === type))
    .sort(compareRecentEvents)
    .slice(0, limit);
  const timestamps = await timestampsFor(queryClient, events);

  return {
    data: events
      .map((event) => ({
        ...event,
        timestamp: timestamps.get(event.blockNumber),
      }))
      .map(serializeTrade),
    meta: {
      chainId: ARC_CHAIN_ID,
      latestBlock: latestBlock.toString(),
      limit,
    },
  };
}
