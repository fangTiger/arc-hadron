"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { mapBidResults, type BidView } from "@/lib/bids";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { readContractCount } from "@/lib/hooks/useAssets";
import { POLL_HOT_MS, POLL_WARM_MS } from "./pollingConstants";
import { visibleRefetch } from "./visibilityAware";

export type { BidView };

interface AllBidsOptions {
  enabled?: boolean;
}

export function useBids(tokenId: bigint | null): { bids: BidView[]; isLoading: boolean } {
  const { address } = useAccount();
  const bidIdsQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "bidsByToken",
    args: tokenId === null ? undefined : [tokenId],
    query: {
      enabled: tokenId !== null,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const bidIds = useMemo(() => (bidIdsQuery.data ?? []) as bigint[], [bidIdsQuery.data]);
  const bidContracts = useMemo(
    () =>
      bidIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getBid",
        args: [id],
      })),
    [bidIds],
  );
  const bidsQuery = useReadContracts({
    allowFailure: false,
    contracts: bidContracts,
    query: {
      enabled: tokenId !== null && bidContracts.length > 0,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const bids = useMemo(
    () =>
      mapBidResults({
        currentAddress: address,
        ids: bidIds,
        results: bidsQuery.data ?? [],
      }),
    [address, bidIds, bidsQuery.data],
  );

  return {
    bids,
    isLoading: bidIdsQuery.isLoading || bidsQuery.isLoading,
  };
}

export function useAllBids(
  { enabled = true }: AllBidsOptions = {},
): { bids: BidView[]; isLoading: boolean } {
  const { address } = useAccount();
  const bidCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "bidCount",
    query: {
      enabled,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const bidCount = readContractCount(bidCountQuery.data);
  const bidIds = useMemo(
    () => Array.from({ length: bidCount }, (_, index) => BigInt(index + 1)),
    [bidCount],
  );
  const bidContracts = useMemo(
    () =>
      bidIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getBid",
        args: [id],
      })),
    [bidIds],
  );
  const bidsQuery = useReadContracts({
    allowFailure: false,
    contracts: bidContracts,
    query: {
      enabled: enabled && bidContracts.length > 0,
      refetchInterval: visibleRefetch(POLL_HOT_MS),
    },
  });
  const bids = useMemo(
    () =>
      mapBidResults({
        currentAddress: address,
        ids: bidIds,
        results: bidsQuery.data ?? [],
      }),
    [address, bidIds, bidsQuery.data],
  );

  return {
    bids,
    isLoading: enabled && (bidCountQuery.isLoading || bidsQuery.isLoading),
  };
}

export function useMyBids(): { bids: BidView[]; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const bidCountQuery = useReadContract({
    address: HADRON_MARKET_ADDRESS,
    abi: HADRON_MARKET_ABI,
    functionName: "bidCount",
    query: {
      enabled: isConnected,
      refetchInterval: visibleRefetch(POLL_WARM_MS),
    },
  });
  const bidCount = readContractCount(bidCountQuery.data);
  const bidIds = useMemo(
    () => Array.from({ length: bidCount }, (_, index) => BigInt(index + 1)),
    [bidCount],
  );
  const bidContracts = useMemo(
    () =>
      bidIds.map((id) => ({
        address: HADRON_MARKET_ADDRESS,
        abi: HADRON_MARKET_ABI,
        functionName: "getBid",
        args: [id],
      })),
    [bidIds],
  );
  const bidsQuery = useReadContracts({
    allowFailure: false,
    contracts: bidContracts,
    query: {
      enabled: Boolean(isConnected && address && bidContracts.length > 0),
      refetchInterval: visibleRefetch(POLL_WARM_MS),
    },
  });
  const bids = useMemo(
    () =>
      mapBidResults({
        currentAddress: address,
        ids: bidIds,
        results: bidsQuery.data ?? [],
      }).filter((bid) => bid.isOwn),
    [address, bidIds, bidsQuery.data],
  );

  return {
    bids,
    isLoading: Boolean(isConnected && address) && (bidCountQuery.isLoading || bidsQuery.isLoading),
  };
}
