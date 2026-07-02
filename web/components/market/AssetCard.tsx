import Link from "next/link";
import { formatShares, formatUsdc } from "@/lib/format";
import type { AssetView } from "@/lib/mappers";
import { glowButtonClassName } from "@/components/ui/GlowButton";

const categoryStyles: Record<string, { label: string; gradient: string }> = {
  treasuries: {
    label: "TREASURIES",
    gradient: "radial-gradient(circle at 20% 20%, #22d3ee 0%, #155e75 42%, #07111a 100%)",
  },
  gold: {
    label: "GOLD",
    gradient: "radial-gradient(circle at 20% 20%, #e9c46a 0%, #7c5c1e 44%, #11100b 100%)",
  },
  "real-estate": {
    label: "REAL ESTATE",
    gradient: "radial-gradient(circle at 20% 20%, #4b647d 0%, #1d2733 46%, #080b10 100%)",
  },
  carbon: {
    label: "CARBON",
    gradient: "radial-gradient(circle at 20% 20%, #34d399 0%, #1e4d3a 44%, #07100c 100%)",
  },
};

function apyText(apyBps: number | null) {
  if (apyBps === null) {
    return null;
  }

  return `${(apyBps / 100).toFixed(2)}% APY`;
}

function remainingRatio(asset: AssetView) {
  if (!asset.offering || asset.totalShares === 0n) {
    return 0;
  }

  const basisPoints = (asset.offering.remaining * 10_000n) / asset.totalShares;
  return Math.min(Number(basisPoints) / 100, 100);
}

export function AssetCard({ asset, featured = false }: { asset: AssetView; featured?: boolean }) {
  const style = categoryStyles[asset.category] ?? categoryStyles["real-estate"];
  const offering = asset.offering;
  const apy = apyText(asset.meta.apyBps);
  const ratio = remainingRatio(asset);

  return (
    <article
      className={[
        "group flex min-h-[420px] flex-col border border-border bg-panel transition-[border-color,box-shadow,transform] duration-200",
        featured
          ? "hover:border-border-glow hover:shadow-[0_0_34px_rgba(34,211,238,0.14)]"
          : "hover:border-border-glow",
      ].join(" ")}
    >
      <div className="relative h-36 border-b border-border" style={{ background: style.gradient }}>
        <span className="absolute bottom-4 left-4 border border-white/10 bg-bg/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-text">
          {style.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="min-h-14 text-xl font-semibold leading-tight text-text">{asset.meta.nameZh}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-dim">{asset.meta.issuer}</p>

        <div className="mt-6 flex items-start justify-between gap-4 border-y border-border py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PRICE</p>
            <p className="mt-2 font-mono text-lg text-text">
              {offering ? `${formatUsdc(offering.pricePerShare)} USDC` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {apy ? "YIELD" : "REMAINING"}
            </p>
            <p className={["mt-2 font-mono text-lg", apy ? "text-gold" : "text-text-dim"].join(" ")}>
              {apy ?? (offering ? formatShares(offering.remaining) : "—")}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {offering ? `REMAINING ${formatShares(offering.remaining)} SHARES` : "NO ACTIVE OFFERING"}
            </p>
            <p className="font-mono text-[10px] text-text-dim">{ratio.toFixed(1)}%</p>
          </div>
          <div className="mt-3 h-px bg-border">
            <div className="h-px bg-neon-dim" style={{ width: `${ratio}%` }} />
          </div>
        </div>

        <div className="mt-auto pt-6">
          {offering ? (
            <Link
              className={glowButtonClassName({ className: "w-full", size: "md" })}
              href={`/asset/${asset.tokenId.toString()}`}
            >
              BUY
            </Link>
          ) : (
            <Link
              className="inline-flex h-10 w-full items-center justify-center border border-border bg-muted/20 px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors hover:border-border-glow hover:text-text"
              href={`/asset/${asset.tokenId.toString()}`}
            >
              VIEW
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
