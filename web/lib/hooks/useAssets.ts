import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import {
  HADRON_ASSETS_ABI,
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ABI,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import {
  computeStats,
  joinAssetsWithOfferings,
  type AssetView,
  type ChainAsset,
  type ChainOffering,
} from "@/lib/mappers";
import { metaBySlug } from "@/lib/metadata";

const REFETCH_INTERVAL_MS = 8000;
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

export function assetReadErrorZh(queries: QueryErrorState[]): string | undefined {
  return queries.some((query) => query.isError) ? ASSETS_READ_ERROR_ZH : undefined;
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

export function useAssets(): { assets: AssetView[]; errorZh?: string; isLoading: boolean } {
  const assetCountQuery = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    functionName: "assetCount",
    query: {
      refetchInterval: REFETCH_INTERVAL_MS,
    },
  });

  const offeringCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "offeringCount",
    query: {
      refetchInterval: REFETCH_INTERVAL_MS,
    },
  });

  const assetCount = readContractCount(assetCountQuery.data);
  const offeringCount = readContractCount(offeringCountQuery.data);

  const assetContracts = useMemo(
    () =>
      Array.from({ length: assetCount }, (_, index) => ({
        address: HADRON_ASSETS_ADDRESS,
        abi: HADRON_ASSETS_ABI,
        functionName: "getAsset",
        args: [BigInt(index + 1)],
      })),
    [assetCount],
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
    allowFailure: false,
    contracts: assetContracts,
    query: {
      enabled: assetCount > 0,
      refetchInterval: REFETCH_INTERVAL_MS,
    },
  });

  const offeringsQuery = useReadContracts({
    allowFailure: false,
    contracts: offeringContracts,
    query: {
      enabled: offeringCount > 0,
      refetchInterval: REFETCH_INTERVAL_MS,
    },
  });

  const assets = useMemo(() => {
    const chainAssets = (assetsQuery.data ?? []).map((asset, index) =>
      normalizeAsset(BigInt(index + 1), asset),
    );
    const offerings = (offeringsQuery.data ?? []).map((offering, index) =>
      normalizeOffering(BigInt(index + 1), offering),
    );

    return joinAssetsWithOfferings(chainAssets, offerings, metaBySlug);
  }, [assetsQuery.data, offeringsQuery.data]);
  const errorZh = assetReadErrorZh([
    assetCountQuery,
    offeringCountQuery,
    assetsQuery,
    offeringsQuery,
  ]);

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
