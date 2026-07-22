import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import {
  HADRON_ASSETS_ABI,
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ABI,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import { FIRST_ACTIVE_TOKEN_ID } from "@/lib/chain";
import {
  computeStats,
  joinAssetsWithOfferings,
  type AssetView,
  type ChainAsset,
  type ChainOffering,
} from "@/lib/mappers";
import { metaBySlug } from "@/lib/metadata";
import { POLL_COLD_MS } from "./pollingConstants";
import { visibleRefetch } from "./visibilityAware";

export const ASSETS_READ_ERROR_ZH = "Failed to load market data from Arc RPC.";

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

interface QueryErrorState {
  isError: boolean;
}

interface AssetReadErrorOptions {
  hasUsableAssets?: boolean;
}

export function readContractCount(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value !== "bigint") {
    throw new Error("On-chain asset count must be a bigint.");
  }

  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("On-chain asset count exceeds the frontend safe range.");
  }

  return Number(value);
}

export function assetReadErrorZh(
  queries: QueryErrorState[],
  options: AssetReadErrorOptions = {},
): string | undefined {
  if (options.hasUsableAssets) {
    return undefined;
  }

  return queries.some((query) => query.isError) ? ASSETS_READ_ERROR_ZH : undefined;
}

export function activeTokenIdsForCount(assetCount: number): bigint[] {
  const first = Number(FIRST_ACTIVE_TOKEN_ID);

  if (assetCount < first) {
    return [];
  }

  return Array.from({ length: assetCount - first + 1 }, (_, index) =>
    BigInt(first + index),
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readResultValue(raw: unknown): unknown | undefined {
  if (!isRecord(raw) || !("status" in raw)) {
    return raw;
  }

  if (raw.status === "success") {
    return raw.result;
  }

  if (raw.status === "failure") {
    return undefined;
  }

  return raw;
}

export function normalizeAssetsFromReadResults(
  tokenIds: readonly bigint[],
  rawAssets: readonly unknown[] | undefined,
): ChainAsset[] {
  return (rawAssets ?? []).flatMap((rawAsset, index) => {
    const tokenId = tokenIds[index];
    const value = readResultValue(rawAsset);

    if (tokenId === undefined || value === undefined || value === null) {
      return [];
    }

    return [normalizeAsset(tokenId, value)];
  });
}

export function normalizeOfferingsFromReadResults(
  rawOfferings: readonly unknown[] | undefined,
): ChainOffering[] {
  return (rawOfferings ?? []).flatMap((rawOffering, index) => {
    const value = readResultValue(rawOffering);

    if (value === undefined || value === null) {
      return [];
    }

    return [normalizeOffering(BigInt(index + 1), value)];
  });
}

export function useAssets(): { assets: AssetView[]; errorZh?: string; isLoading: boolean } {
  const assetCountQuery = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    functionName: "assetCount",
    query: {
      refetchInterval: visibleRefetch(POLL_COLD_MS),
    },
  });

  const offeringCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "offeringCount",
    query: {
      refetchInterval: visibleRefetch(POLL_COLD_MS),
    },
  });

  const assetCount = readContractCount(assetCountQuery.data);
  const offeringCount = readContractCount(offeringCountQuery.data);
  const activeTokenIds = useMemo(() => activeTokenIdsForCount(assetCount), [assetCount]);

  const assetContracts = useMemo(
    () =>
      activeTokenIds.map((tokenId) => ({
        address: HADRON_ASSETS_ADDRESS,
        abi: HADRON_ASSETS_ABI,
        functionName: "getAsset",
        args: [tokenId],
      })),
    [activeTokenIds],
  );

  const offeringContracts = useMemo(
    () =>
      Array.from({ length: offeringCount }, (_, index) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getOffering",
        args: [BigInt(index + 1)],
      })),
    [offeringCount],
  );

  const assetsQuery = useReadContracts({
    allowFailure: true,
    contracts: assetContracts,
    query: {
      enabled: assetContracts.length > 0,
      refetchInterval: visibleRefetch(POLL_COLD_MS),
    },
  });

  const offeringsQuery = useReadContracts({
    allowFailure: true,
    contracts: offeringContracts,
    query: {
      enabled: offeringCount > 0,
      refetchInterval: visibleRefetch(POLL_COLD_MS),
    },
  });

  const assets = useMemo(() => {
    const chainAssets = normalizeAssetsFromReadResults(activeTokenIds, assetsQuery.data);
    const offerings = normalizeOfferingsFromReadResults(offeringsQuery.data);

    return joinAssetsWithOfferings(chainAssets, offerings, metaBySlug);
  }, [activeTokenIds, assetsQuery.data, offeringsQuery.data]);
  const errorZh = assetReadErrorZh([
    assetCountQuery,
    offeringCountQuery,
    assetsQuery,
    offeringsQuery,
  ], { hasUsableAssets: assets.length > 0 });

  return {
    assets,
    errorZh,
    isLoading:
      !errorZh &&
      (assetCountQuery.isLoading ||
        offeringCountQuery.isLoading ||
        assetsQuery.isLoading ||
        offeringsQuery.isLoading),
  };
}

export function useMarketStats(): {
  tvl: bigint;
  avgApyBps: number | null;
  errorZh?: string;
  isLoading: boolean;
} {
  const { assets, errorZh, isLoading } = useAssets();
  const stats = useMemo(() => computeStats(assets), [assets]);

  return { ...stats, errorZh, isLoading };
}
