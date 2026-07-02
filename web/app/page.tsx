import { ActivityFeedPlaceholder } from "@/components/market/ActivityFeedPlaceholder";
import { AssetGrid } from "@/components/market/AssetGrid";
import { StatsBar } from "@/components/market/StatsBar";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 text-text sm:px-6 lg:px-8">
      <section className="grid min-h-[420px] items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
            REAL-WORLD ASSET EXCHANGE ON ARC
          </p>
          <h1 className="mt-5 font-mono text-5xl font-semibold tracking-[0.2em] text-text sm:text-7xl">
            HADRON<span className="text-neon">.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-text-dim">
            承载真实资产的链上交易所。浏览链上发行资产、比较价格与收益口径，并在 Arc testnet
            上完成可查证的一级购买。
          </p>
        </div>

        <div className="flex min-h-72 items-center justify-center border border-dashed border-border-glow bg-panel/40">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">3D HERO / M5</p>
        </div>
      </section>

      <div className="space-y-8">
        <StatsBar />
        <AssetGrid />
        <ActivityFeedPlaceholder />
      </div>
    </main>
  );
}
