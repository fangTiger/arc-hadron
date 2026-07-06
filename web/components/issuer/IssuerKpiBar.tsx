import { Skeleton } from "@/components/ui/Skeleton";
import { formatShares, formatUsdc } from "@/lib/format";
import { formatApyBps } from "@/lib/marketMetrics";

export interface IssuerKpiBarKpis {
  assetsCount: number;
  totalShares: bigint;
  cumulativeVolumeUsdc?: bigint;
  weightedApyBps: number | null;
}

interface KpiCell {
  label: string;
  value: string;
  tone?: string;
}

function KpiValue({ cell }: { cell: KpiCell }) {
  return (
    <div className="border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {cell.label}
      </dt>
      <dd className={["mt-2 font-mono text-lg font-semibold text-text", cell.tone ?? ""].join(" ")}>
        {cell.value}
      </dd>
    </div>
  );
}

export function IssuerKpiBar({ kpis }: { kpis: IssuerKpiBarKpis }) {
  const cells: KpiCell[] = [
    { label: "Assets", value: kpis.assetsCount.toString() },
    { label: "Total Shares Issued", value: formatShares(kpis.totalShares) },
    {
      label: "Weighted APY",
      value: formatApyBps(kpis.weightedApyBps),
      tone: "text-gold",
    },
  ];

  return (
    <dl className="grid overflow-hidden border border-border bg-panel/85 sm:grid-cols-4">
      <KpiValue cell={cells[0]} />
      <KpiValue cell={cells[1]} />
      <div className="border-b border-border px-4 py-4 sm:border-b-0 sm:border-r">
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Cumulative Volume
        </dt>
        <dd className="mt-2 min-h-7 font-mono text-lg font-semibold text-text">
          {kpis.cumulativeVolumeUsdc === undefined ? (
            <Skeleton
              className="h-6 w-28"
              data-testid="issuer-volume-skeleton"
              tone="soft"
            />
          ) : (
            `${formatUsdc(kpis.cumulativeVolumeUsdc, { compact: true })} USDC`
          )}
        </dd>
      </div>
      <KpiValue cell={cells[2]} />
    </dl>
  );
}
