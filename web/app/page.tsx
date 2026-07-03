"use client";

import { useMemo, useState } from "react";
import { MarketBrief } from "@/components/ai/MarketBrief";
import { ActivityPanel } from "@/components/market/ActivityPanel";
import { CategoryTabs, type MarketCategory } from "@/components/market/CategoryTabs";
import { LiveTicker } from "@/components/market/LiveTicker";
import { MarketTable } from "@/components/market/MarketTable";
import { StatsStrip } from "@/components/market/StatsStrip";
import { displayCategoryForChainCategory } from "@/lib/categories";
import type { TradeEvent } from "@/lib/events";
import { useAssets } from "@/lib/hooks/useAssets";
import { useAllListings, type ListingView } from "@/lib/hooks/useListings";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";
import type { AssetView } from "@/lib/mappers";

export function HomeView({
  assets,
  errorZh,
  events,
  eventsError,
  isAssetsLoading,
  isEventsLoading,
  marketListings,
  nowMs,
}: {
  assets: AssetView[];
  errorZh?: string;
  events: TradeEvent[];
  eventsError?: Error;
  isAssetsLoading: boolean;
  isEventsLoading: boolean;
  marketListings: ListingView[];
  nowMs: number;
}) {
  const [category, setCategory] = useState<MarketCategory>("all");
  const [search, setSearch] = useState("");

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesCategory =
        category === "all" || displayCategoryForChainCategory(asset.category) === category;
      const matchesSearch =
        query.length === 0 ||
        asset.meta.displayName.toLowerCase().includes(query) ||
        asset.meta.ticker.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [assets, category, search]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 text-text sm:px-6 lg:px-8">
      <div className="space-y-5">
        <StatsStrip
          assets={assets}
          events={events}
          isLoading={isAssetsLoading || isEventsLoading}
          nowMs={nowMs}
        />

        <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CategoryTabs onChange={setCategory} value={category} />
          <label className="block w-full lg:max-w-xs">
            <span className="sr-only">Search assets</span>
            <input
              className="h-10 w-full border border-border bg-panel/80 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="SEARCH ASSET / TICKER"
              value={search}
            />
          </label>
        </section>

        {eventsError ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-down">
            Event stream unavailable: {eventsError.message}
          </p>
        ) : null}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <MarketTable
              assets={filteredAssets}
              errorText={errorZh}
              events={events}
              isLoading={isAssetsLoading}
              nowMs={nowMs}
            />
          </div>
          <div className="w-full space-y-5 lg:w-[280px] lg:shrink-0">
            <MarketBrief
              assets={assets}
              events={events}
              listings={marketListings}
              nowMs={nowMs}
            />
            <ActivityPanel assets={assets} events={events} nowMs={nowMs} />
          </div>
        </section>
      </div>

      <LiveTicker assets={assets} events={events} />
    </main>
  );
}

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
