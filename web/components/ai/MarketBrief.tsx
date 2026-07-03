"use client";

import { useMemo } from "react";
import { AiPanelView, type InsightPanelViewProps } from "@/components/ai/InsightPanel";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import type { TradeEvent } from "@/lib/events";
import type { ListingView } from "@/lib/listing";
import { buildMarketSnapshot } from "@/lib/ai/snapshot";
import { useAiGeneration } from "@/lib/ai/useAiGeneration";
import type { AssetView } from "@/lib/mappers";

export function MarketBriefView(props: InsightPanelViewProps) {
  return <AiPanelView emptyText="No brief generated yet." title="MARKET BRIEF" {...props} />;
}

export function MarketBrief({
  assets,
  events,
  listings,
  nowMs,
}: {
  assets: AssetView[];
  events: TradeEvent[];
  listings: ListingView[];
  nowMs: number;
}) {
  const snapshot = useMemo(
    () =>
      buildMarketSnapshot({
        assets,
        events,
        listings,
        nowMs,
      }),
    [assets, events, listings, nowMs],
  );
  const generation = useAiGeneration({
    chainId: ARC_CHAIN_ID,
    endpoint: "/api/ai/brief",
    marketAddress: HADRON_MARKET_ADDRESS,
    purpose: "brief",
    snapshot,
  });

  // 复用资产洞察的交互语义，市场级容器只更换快照和路由。
  function generate() {
    void generation.generate();
  }

  return (
    <MarketBriefView
      error={generation.error}
      generatedAt={generation.generatedAt}
      isStale={generation.isStale}
      markdown={generation.markdown}
      nowMs={nowMs}
      onGenerate={generate}
      status={generation.status}
    />
  );
}
