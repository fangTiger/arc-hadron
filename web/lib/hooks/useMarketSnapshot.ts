"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetView } from "@/lib/mappers";
import {
  MARKET_ASSETS_QUERY_KEY,
  MARKET_ASSETS_REFRESH_MS,
  deriveMarketAssetsState,
  fetchMarketAssetsSnapshot,
  readMarketAssetsCache,
} from "@/lib/marketSnapshot";
import { visibleRefetch } from "@/lib/hooks/visibilityAware";

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function useMarketSnapshot() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MARKET_ASSETS_QUERY_KEY,
    queryFn: () =>
      fetchMarketAssetsSnapshot({
        storage: browserStorage(),
      }),
    refetchInterval: visibleRefetch(MARKET_ASSETS_REFRESH_MS),
    staleTime: MARKET_ASSETS_REFRESH_MS,
  });

  useEffect(() => {
    const storage = browserStorage();

    if (!storage) {
      return;
    }

    const snapshot = readMarketAssetsCache(storage);
    const currentData = queryClient.getQueryData<AssetView[]>(MARKET_ASSETS_QUERY_KEY);

    if (snapshot && currentData === undefined) {
      queryClient.setQueryData(MARKET_ASSETS_QUERY_KEY, snapshot.assets, {
        updatedAt: snapshot.updatedAt,
      });
    }
  }, [queryClient]);

  return deriveMarketAssetsState({
    data: query.data,
    isError: query.isError,
    isPending: query.isPending,
  });
}
