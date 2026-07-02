import { Skeleton } from "@/components/ui/Skeleton";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-7xl flex-col justify-center px-4 py-10 text-text sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon">
              HADRON MARKET SKELETON
            </p>
            <h1 className="font-mono text-4xl font-semibold tracking-[0.2em] text-text sm:text-6xl">
              HADRON<span className="text-neon">.</span>
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" tone="soft" />
            <Skeleton className="h-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" tone="soft" />
          </div>
        </div>
        <aside className="space-y-3 border border-border bg-panel/60 p-4">
          <Skeleton className="h-8" />
          <Skeleton className="h-16" tone="soft" />
          <Skeleton className="h-16" tone="soft" />
          <Skeleton className="h-16" tone="soft" />
        </aside>
      </section>
    </main>
  );
}
