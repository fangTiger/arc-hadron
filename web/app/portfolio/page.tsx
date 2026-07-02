import { HoldingsTable } from "@/components/portfolio/HoldingsTable";

export default function PortfolioPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 text-text sm:px-6 lg:px-8">
      <section className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">PORTFOLIO</p>
        <h1 className="mt-4 text-3xl font-semibold text-text sm:text-4xl">My holdings</h1>
      </section>

      <HoldingsTable />
    </main>
  );
}
