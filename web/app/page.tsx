"use client";

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
  const { listings: marketListings } = useAllListings();

  return (
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
  );
}
