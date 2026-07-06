import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AiPanelView, InsightPanelView } from "../components/ai/InsightPanel";
import { MarketBriefView } from "../components/ai/MarketBrief";

const NOW_MS = Date.UTC(2026, 6, 3, 12);

function panelProps() {
  return {
    error: null,
    generatedAt: NOW_MS,
    isStale: false,
    markdown: "## Movers\nLong market brief body",
    nowMs: NOW_MS,
    onGenerate: () => undefined,
    status: "done" as const,
  };
}

describe("AiPanelView compact mode", () => {
  test("wraps markdown in a limited scroll container with a bottom fade when compact", () => {
    const html = renderToStaticMarkup(
      <AiPanelView
        compact
        emptyText="No brief generated yet."
        title="MARKET BRIEF"
        {...panelProps()}
      />,
    );

    expect(html).toContain("data-ai-panel-body=\"compact\"");
    expect(html).toContain("max-h-[16rem]");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("data-ai-panel-fade=\"bottom\"");
  });

  test("keeps the default markdown layout when compact is not passed", () => {
    const html = renderToStaticMarkup(
      <AiPanelView emptyText="No insight generated yet." title="ASSET INSIGHT" {...panelProps()} />,
    );

    expect(html).toContain("max-w-[70ch]");
    expect(html).not.toContain("data-ai-panel-body=\"compact\"");
    expect(html).not.toContain("max-h-[16rem]");
  });

  test("stacks the compact header while preserving the default horizontal header", () => {
    const compact = renderToStaticMarkup(
      <AiPanelView
        compact
        emptyText="No brief generated yet."
        title="MARKET BRIEF"
        {...panelProps()}
      />,
    );
    const defaultPanel = renderToStaticMarkup(
      <AiPanelView emptyText="No insight generated yet." title="ASSET INSIGHT" {...panelProps()} />,
    );

    expect(compact).not.toContain("sm:flex-row");
    expect(compact).not.toContain("sm:items-center");
    expect(compact).not.toContain("sm:justify-between");
    expect(defaultPanel).toContain("sm:flex-row");
    expect(defaultPanel).toContain("sm:items-center");
    expect(defaultPanel).toContain("sm:justify-between");
  });

  test("applies compact mode to MarketBriefView only", () => {
    const brief = renderToStaticMarkup(<MarketBriefView {...panelProps()} />);
    const insight = renderToStaticMarkup(<InsightPanelView {...panelProps()} />);

    expect(brief).toContain("MARKET BRIEF");
    expect(brief).toContain("data-ai-panel-body=\"compact\"");
    expect(insight).toContain("ASSET INSIGHT");
    expect(insight).not.toContain("data-ai-panel-body=\"compact\"");
  });
});
