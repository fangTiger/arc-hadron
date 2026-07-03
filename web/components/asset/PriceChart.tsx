"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AreaData, UTCTimestamp } from "lightweight-charts";
import type { TradeEvent } from "@/lib/events";
import {
  issueSharePriceForAsset,
  priceSeriesToAreaData,
  usdcValueFromWei,
  type PriceAreaData,
} from "@/lib/chartData";
import { priceSeriesForAsset, tradeEventsForAsset } from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";

type LightweightChartsModule = Pick<
  typeof import("lightweight-charts"),
  | "AreaSeries"
  | "ColorType"
  | "CrosshairMode"
  | "LastPriceAnimationMode"
  | "LineStyle"
  | "createChart"
>;

interface MountedPriceChart {
  remove: () => void;
  setData: (data: readonly PriceAreaData[], issuePrice: number) => void;
}

const chartColors = {
  border: "#1c2333",
  gold: "#e9c46a",
  grid: "rgba(28, 35, 51, 0.72)",
  muted: "#7d8591",
  neon: "#22d3ee",
  neonDim: "#67e8f9",
  panelTransparent: "rgba(0, 0, 0, 0)",
  textDim: "#9ca3af",
  up: "#34d399",
};

export function mountLightweightPriceChart(
  container: HTMLElement,
  data: readonly PriceAreaData[],
  issuePrice: number,
  charts: LightweightChartsModule,
): MountedPriceChart {
  const chart = charts.createChart(container, {
    autoSize: true,
    crosshair: {
      horzLine: {
        color: "rgba(103, 232, 249, 0.34)",
        labelVisible: true,
        style: charts.LineStyle.Dotted,
        width: 1,
      },
      mode: charts.CrosshairMode.Normal,
      vertLine: {
        color: "rgba(103, 232, 249, 0.34)",
        labelVisible: true,
        style: charts.LineStyle.Dotted,
        width: 1,
      },
    },
    grid: {
      horzLines: {
        color: chartColors.grid,
        style: charts.LineStyle.Dotted,
        visible: true,
      },
      vertLines: {
        color: chartColors.grid,
        style: charts.LineStyle.Dotted,
        visible: true,
      },
    },
    height: 260,
    layout: {
      attributionLogo: false,
      background: {
        color: chartColors.panelTransparent,
        type: charts.ColorType.Solid,
      },
      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 11,
      textColor: chartColors.textDim,
    },
    localization: {
      priceFormatter: (price: number) => price.toFixed(2),
    },
    rightPriceScale: {
      borderColor: chartColors.border,
      borderVisible: true,
      scaleMargins: {
        bottom: 0.16,
        top: 0.12,
      },
      textColor: chartColors.textDim,
      ticksVisible: false,
      visible: true,
    },
    timeScale: {
      borderColor: chartColors.border,
      borderVisible: true,
      fixLeftEdge: true,
      fixRightEdge: true,
      rightOffset: 3,
      secondsVisible: false,
      timeVisible: true,
      visible: true,
    },
  });

  const areaSeries = chart.addSeries(charts.AreaSeries, {
    bottomColor: "rgba(34, 211, 238, 0)",
    lastPriceAnimation: charts.LastPriceAnimationMode.OnDataUpdate,
    lineColor: chartColors.up,
    lineWidth: 2,
    priceFormat: {
      minMove: 0.01,
      precision: 2,
      type: "price",
    },
    priceLineColor: chartColors.up,
    priceLineVisible: true,
    priceLineWidth: 1,
    topColor: "rgba(52, 211, 153, 0.28)",
  });

  const issueLine = areaSeries.createPriceLine({
    axisLabelVisible: true,
    color: chartColors.gold,
    lineStyle: charts.LineStyle.Dashed,
    lineVisible: true,
    lineWidth: 1,
    price: issuePrice,
    title: "ISSUE",
  });

  function setData(nextData: readonly PriceAreaData[], nextIssuePrice: number) {
    areaSeries.setData([...nextData] as AreaData<UTCTimestamp>[]);
    issueLine.applyOptions({ price: nextIssuePrice });
    chart.timeScale().fitContent();
  }

  setData(data, issuePrice);

  return {
    remove: () => chart.remove(),
    setData,
  };
}

export function PriceChart({
  asset,
  events,
}: {
  asset: AssetView;
  events: TradeEvent[];
}) {
  const issueSharePrice = useMemo(() => issueSharePriceForAsset(asset), [asset]);
  const chartData = useMemo(
    () => priceSeriesToAreaData(priceSeriesForAsset(asset, events), issueSharePrice),
    [asset, events, issueSharePrice],
  );
  const issuePrice = useMemo(() => usdcValueFromWei(issueSharePrice), [issueSharePrice]);
  const trades = useMemo(() => tradeEventsForAsset(events, asset.tokenId), [asset.tokenId, events]);
  const chartRef = useRef<MountedPriceChart | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef(chartData);
  const issuePriceRef = useRef(issuePrice);
  const latest = chartData.at(-1)?.value ?? issuePrice;
  const first = chartData[0]?.value ?? issuePrice;
  const trendTone = latest > first ? "text-up" : latest < first ? "text-down" : "text-muted";

  useEffect(() => {
    dataRef.current = chartData;
    issuePriceRef.current = issuePrice;
    chartRef.current?.setData(chartData, issuePrice);
  }, [chartData, issuePrice]);

  useEffect(() => {
    let disposed = false;

    void import("lightweight-charts").then((charts) => {
      if (disposed || containerRef.current === null) {
        return;
      }

      chartRef.current = mountLightweightPriceChart(
        containerRef.current,
        dataRef.current,
        issuePriceRef.current,
        charts,
      );
    });

    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  return (
    <section className="border border-border bg-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">PRICE TREND</h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {trades.length} TRADES
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">LAST</p>
          <p className={`mt-1 font-mono text-sm ${trendTone}`}>{latest.toFixed(2)} USDC</p>
        </div>
      </div>

      <div
        aria-label={`${asset.meta.ticker} price trend chart`}
        className="mt-5 h-[260px] w-full overflow-hidden"
        ref={containerRef}
      />

      {trades.length < 2 ? (
        <p className="mt-3 text-sm text-muted">Awaiting secondary trades for richer price history</p>
      ) : null}
    </section>
  );
}
