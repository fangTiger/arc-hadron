"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { MarketBrief } from "@/components/ai/MarketBrief";
import { ActivityPanel } from "@/components/market/ActivityPanel";
import { CategoryTabs, type MarketCategory } from "@/components/market/CategoryTabs";
import { ExploreIssuerFilter } from "@/components/market/ExploreIssuerFilter";
import { ExploreYieldFilter } from "@/components/market/ExploreYieldFilter";
import { LiveTicker } from "@/components/market/LiveTicker";
import { MarketTable } from "@/components/market/MarketTable";
import { StatsStrip } from "@/components/market/StatsStrip";
import { CATEGORY_TAB_OPTIONS } from "@/lib/categories";
import type { TradeEvent } from "@/lib/events";
import { filterAssets, isYieldBucket, type YieldBucket } from "@/lib/filterAssets";
import type { ListingView } from "@/lib/hooks/useListings";
import { listIssuers } from "@/lib/issuers";
import type { AssetView } from "@/lib/mappers";

const VALID_CATEGORY_VALUES = new Set(CATEGORY_TAB_OPTIONS.map((option) => option.value));

function categoryFromParam(value: string | null): MarketCategory {
  return value !== null && VALID_CATEGORY_VALUES.has(value as MarketCategory)
    ? (value as MarketCategory)
    : "all";
}

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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = categoryFromParam(searchParams.get("category"));
  const query = searchParams.get("q") ?? "";
  const rawIssuerSlug = searchParams.get("issuer");
  const rawYieldBucket = searchParams.get("yield");
  const yieldBucket: YieldBucket | null = isYieldBucket(rawYieldBucket) ? rawYieldBucket : null;
  const issuerOptions = useMemo(
    () =>
      listIssuers().map((issuer) => ({
        assetsCount: issuer.assetIds.length,
        displayName: issuer.displayName,
        slug: issuer.slug,
      })),
    [],
  );
  const selectedIssuerSlug = issuerOptions.some((issuer) => issuer.slug === rawIssuerSlug)
    ? rawIssuerSlug
    : null;

  const replaceQueryParam = useCallback(
    (key: "category" | "issuer" | "q" | "yield", value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      const shouldDelete = value === null || value.trim() === "" || (key === "category" && value === "all");

      if (shouldDelete) {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      const nextQuery = params.toString();

      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const resetFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const filteredAssets = useMemo(() => {
    return filterAssets(assets, {
      category,
      issuerSlug: selectedIssuerSlug,
      query,
      yieldBucket,
    });
  }, [assets, category, query, selectedIssuerSlug, yieldBucket]);
  const hasActiveFilters =
    category !== "all" ||
    selectedIssuerSlug !== null ||
    yieldBucket !== null ||
    query.trim().length > 0;
  const emptyState =
    hasActiveFilters && filteredAssets.length === 0 ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>No assets match current filters. Reset filters.</span>
        <button
          className="inline-flex h-8 items-center justify-center border border-neon/50 bg-neon/12 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neon transition-colors duration-200 hover:border-neon hover:bg-neon/20"
          onClick={resetFilters}
          type="button"
        >
          Reset
        </button>
      </div>
    ) : undefined;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 text-text sm:px-6 lg:px-8">
      <div className="space-y-5">
        <StatsStrip
          assets={assets}
          events={events}
          isLoading={isAssetsLoading || isEventsLoading}
          nowMs={nowMs}
        />

        <section className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CategoryTabs
              onChange={(nextCategory) => replaceQueryParam("category", nextCategory)}
              value={category}
            />
            <label className="block w-full lg:max-w-xs">
              <span className="sr-only">Search assets</span>
              <input
                className="h-10 w-full border border-border bg-panel/80 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon"
                onChange={(event) => replaceQueryParam("q", event.target.value)}
                placeholder="SEARCH ASSET / TICKER"
                value={query}
              />
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-20 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Issuer:
              </span>
              <ExploreIssuerFilter
                issuers={issuerOptions}
                onChange={(slug) => replaceQueryParam("issuer", slug)}
                selectedSlug={selectedIssuerSlug}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-20 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Yield:
              </span>
              <ExploreYieldFilter
                onChange={(bucket) => replaceQueryParam("yield", bucket)}
                selected={yieldBucket}
              />
            </div>
          </div>
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
              emptyState={emptyState}
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
