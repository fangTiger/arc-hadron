import Link from "next/link";
import { categoryDisplay } from "@/lib/categories";
import { formatShares, formatUsdc } from "@/lib/format";
import type { AssetView } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";
import { glowButtonClassName } from "@/components/ui/GlowButton";

function apyText(apyBps: number | null) {
  if (apyBps === null) {
    return null;
  }

  return `${(apyBps / 100).toFixed(2)}% APY`;
}

export function remainingRatio(asset: AssetView) {
  if (!asset.offering || asset.totalShares === 0n) {
    return 0;
  }

  const basisPoints = (asset.offering.remaining * 10_000n) / asset.totalShares;
  const cappedBasisPoints = basisPoints > 10_000n ? 10_000n : basisPoints;

  return Number(cappedBasisPoints) / 100;
}

export function AssetCard({ asset, featured = false }: { asset: AssetView; featured?: boolean }) {
  const style = categoryDisplay(asset.category);
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
        <span
          className={[
            "absolute bottom-4 left-4 border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
            style.tickerClassName,
          ].join(" ")}
        >
          {asset.meta.ticker}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-h-14 flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{style.label}</p>
          <h2 className="text-xl font-semibold leading-tight text-text">{asset.meta.displayName}</h2>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-dim">{asset.meta.issuer}</p>

        <div className="mt-6 flex items-start justify-between gap-4 border-y border-border py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PRICE</p>
            <p className="mt-2 font-mono text-lg text-text">
              {offering ? `${formatUsdc(unitPriceToSharePrice(offering.pricePerShare))} USDC` : "—"}
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
