import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { MyBids } from "@/components/portfolio/MyBids";
import { MyListings } from "@/components/portfolio/MyListings";

export default function PortfolioPage() {
  return (
    <main className="hadron-shell py-7 text-text sm:py-10">
      <section className="mb-6 border-b border-border pb-5 sm:mb-8 sm:pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">PORTFOLIO</p>
        <h1 className="mt-3 text-3xl font-semibold text-text sm:mt-4 sm:text-4xl">My holdings</h1>
      </section>

      <HoldingsTable />
      <MyListings />
      <MyBids />
    </main>
  );
}
