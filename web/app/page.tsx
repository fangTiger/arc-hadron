"use client";

import { Suspense } from "react";
import { HomeView } from "./HomeView";
import { useAssets } from "@/lib/hooks/useAssets";
import { useAllListings } from "@/lib/hooks/useListings";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";

export default function Home() {
  const { assets, errorZh, isLoading: isAssetsLoading } = useAssets();
  const {
    events,
    error: eventsError,
    isLoading: isEventsLoading,
    nowMs,
  } = useMarketEvents();
  const { listings: marketListings } = useAllListings({
    enabled: assets.length > 0 && !isAssetsLoading,
  });

  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 text-text sm:px-6 lg:px-8" />
      }
    >
      <HomeView
        assets={assets}
        errorZh={errorZh}
        events={events}
        eventsError={eventsError}
        isAssetsLoading={isAssetsLoading}
        isEventsLoading={isEventsLoading}
        marketListings={marketListings}
        nowMs={nowMs}
      />
    </Suspense>
  );
}
