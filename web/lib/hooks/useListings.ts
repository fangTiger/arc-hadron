"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { mapListingResults, type ListingView } from "@/lib/listing";
import { readContractCount } from "@/lib/hooks/useAssets";
import { POLL_HOT_MS, POLL_WARM_MS } from "./pollingConstants";
import { visibleRefetch } from "./visibilityAware";

export type { ListingView };

export function useListings(tokenId: bigint | null): { listings: ListingView[]; isLoading: boolean } {
  const { address } = useAccount();
  const listingIdsQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "listingsByToken",
    args: tokenId === null ? undefined : [tokenId],
    query: {
      enabled: tokenId !== null,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const listingIds = useMemo(() => (listingIdsQuery.data ?? []) as bigint[], [listingIdsQuery.data]);
  const listingContracts = useMemo(
    () =>
      listingIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getListing",
        args: [id],
      })),
    [listingIds],
  );
  const listingsQuery = useReadContracts({
    allowFailure: false,
    contracts: listingContracts,
    query: {
      enabled: tokenId !== null && listingContracts.length > 0,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const listings = useMemo(
    () =>
      mapListingResults({
        currentAddress: address,
        ids: listingIds,
        results: listingsQuery.data ?? [],
      }),
    [address, listingIds, listingsQuery.data],
  );

  return {
    listings,
    isLoading: listingIdsQuery.isLoading || listingsQuery.isLoading,
  };
}

export function useAllListings(): { listings: ListingView[]; isLoading: boolean } {
  const { address } = useAccount();
  const listingCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "listingCount",
    query: {
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const listingCount = readContractCount(listingCountQuery.data);
  const listingIds = useMemo(
    () => Array.from({ length: listingCount }, (_, index) => BigInt(index + 1)),
    [listingCount],
  );
  const listingContracts = useMemo(
    () =>
      listingIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getListing",
        args: [id],
      })),
    [listingIds],
  );
  const listingsQuery = useReadContracts({
    allowFailure: false,
    contracts: listingContracts,
    query: {
      enabled: listingContracts.length > 0,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const listings = useMemo(
    () =>
      mapListingResults({
        currentAddress: address,
        ids: listingIds,
        results: listingsQuery.data ?? [],
      }),
    [address, listingIds, listingsQuery.data],
  );

  return {
    listings,
    isLoading: listingCountQuery.isLoading || listingsQuery.isLoading,
  };
}

export function useMyListings(): { listings: ListingView[]; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const listingCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "listingCount",
    query: {
      enabled: isConnected,
      refetchInterval: visibleRefetch(POLL_WARM_MS),
    },
  });
  const listingCount = readContractCount(listingCountQuery.data);
  const listingIds = useMemo(
    () => Array.from({ length: listingCount }, (_, index) => BigInt(index + 1)),
    [listingCount],
  );
  const listingContracts = useMemo(
    () =>
      listingIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getListing",
        args: [id],
      })),
    [listingIds],
  );
  const listingsQuery = useReadContracts({
    allowFailure: false,
    contracts: listingContracts,
    query: {
      enabled: Boolean(isConnected && address && listingContracts.length > 0),
      refetchInterval: visibleRefetch(POLL_WARM_MS),
    },
  });
  const listings = useMemo(
    () =>
      mapListingResults({
        currentAddress: address,
        ids: listingIds,
        results: listingsQuery.data ?? [],
      }).filter((listing) => listing.isMine),
    [address, listingIds, listingsQuery.data],
  );

  return {
    listings,
    isLoading:
      Boolean(isConnected && address) && (listingCountQuery.isLoading || listingsQuery.isLoading),
  };
}
