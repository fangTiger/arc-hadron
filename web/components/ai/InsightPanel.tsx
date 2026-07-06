"use client";

import { useMemo } from "react";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import type { TradeEvent } from "@/lib/events";
import type { ListingView } from "@/lib/listing";
import { buildAssetSnapshot } from "@/lib/ai/snapshot";
import { useAiGeneration, type AiGenerationStatus } from "@/lib/ai/useAiGeneration";
import type { AssetView } from "@/lib/mappers";

const DISCLAIMER = "AI-generated · testnet demo data · not financial advice";

function generatedAgo(generatedAt: number | null, nowMs: number): string {
  if (!generatedAt) {
    return "just now";
  }

  const elapsedMs = Math.max(0, nowMs - generatedAt);
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

// 按钮只放短动词，避免在窄侧栏溢出；时间戳单独作为 meta 文本展示。
function actionLabel({ isStale, status }: { isStale: boolean; status: AiGenerationStatus }) {
  if (status === "streaming") {
    return "Generating";
  }

  if (status === "error") {
    return "Retry";
  }

  if (status === "done") {
    return isStale ? "Regenerate" : "Refresh";
  }

  return "Generate";
}

export interface AiPanelViewProps {
  title: string;
  emptyText: string;
  status: AiGenerationStatus;
  markdown: string;
  error: string | null;
  generatedAt: number | null;
  isStale: boolean;
  nowMs: number;
  onGenerate: () => void;
  compact?: boolean;
}

export function AiPanelView({
  compact = false,
  emptyText,
  error,
  generatedAt,
  isStale,
  markdown,
  nowMs,
  onGenerate,
  status,
  title,
}: AiPanelViewProps) {
  const isStreaming = status === "streaming";

  return (
    <section className="overflow-hidden border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">
            {title}
          </h2>
          {isStale ? (
            <span className="border border-gold/50 bg-gold/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
              Data changed
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {status === "done" ? (
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Generated {generatedAgo(generatedAt, nowMs)}
            </span>
          ) : null}
          <button
            className={glowButtonClassName({ disabled: isStreaming, size: "sm" })}
            disabled={isStreaming}
            onClick={onGenerate}
            type="button"
          >
            {actionLabel({ isStale, status })}
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {status === "error" ? (
          <div className="border border-down/70 bg-down/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-down">
              {error ?? "Generation failed"}
            </p>
          </div>
        ) : null}

        {markdown ? (
          compact ? (
            <div className="relative max-w-[70ch]">
              <div
                className="max-h-[16rem] overflow-y-auto pr-2"
                data-ai-panel-body="compact"
              >
                <AiMarkdown markdown={markdown} />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-panel to-transparent"
                data-ai-panel-fade="bottom"
              />
            </div>
          ) : (
            <div className="max-w-[70ch]">
              <AiMarkdown markdown={markdown} />
            </div>
          )
        ) : status === "idle" ? (
          <p className="text-sm leading-6 text-muted">{emptyText}</p>
        ) : null}

        <p className="border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {DISCLAIMER}
        </p>
      </div>
    </section>
  );
}

export type InsightPanelViewProps = Omit<AiPanelViewProps, "compact" | "emptyText" | "title">;

export function InsightPanelView(props: InsightPanelViewProps) {
  return <AiPanelView emptyText="No insight generated yet." title="ASSET INSIGHT" {...props} />;
}

export function InsightPanel({
  asset,
  events,
  listings,
  nowMs,
}: {
  asset: AssetView;
  events: TradeEvent[];
  listings: ListingView[];
  nowMs: number;
}) {
  const snapshot = useMemo(
    () =>
      buildAssetSnapshot({
        asset,
        events,
        listings,
        nowMs,
      }),
    [asset, events, listings, nowMs],
  );
  const generation = useAiGeneration({
    chainId: ARC_CHAIN_ID,
    endpoint: "/api/ai/insight",
    marketAddress: HADRON_MARKET_ADDRESS,
    purpose: "insight",
    snapshot,
    tokenId: asset.tokenId,
  });

  // 事件处理保持在容器层，便于 View 只负责渲染状态。
  function generate() {
    void generation.generate();
  }

  return (
    <InsightPanelView
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
