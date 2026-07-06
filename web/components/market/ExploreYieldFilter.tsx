"use client";

import { type YieldBucket } from "@/lib/filterAssets";

const YIELD_OPTIONS: { label: string; value: YieldBucket }[] = [
  { label: "<4%", value: "lt4" },
  { label: "4-6%", value: "4to6" },
  { label: "6-10%", value: "6to10" },
  { label: ">10%", value: "gt10" },
];

export type { YieldBucket } from "@/lib/filterAssets";

export function ExploreYieldFilter({
  onChange,
  selected,
}: {
  onChange: (bucket: YieldBucket | null) => void;
  selected: YieldBucket | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {YIELD_OPTIONS.map((bucket) => {
        const active = selected === bucket.value;

        return (
          <button
            aria-pressed={active}
            className={[
              "h-9 border px-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200",
              active
                ? "border-border-glow bg-neon/10 text-neon"
                : "border-border bg-panel/60 text-muted hover:border-border-glow hover:text-text",
            ].join(" ")}
            key={bucket.value}
            onClick={() => onChange(active ? null : bucket.value)}
            type="button"
          >
            {bucket.label}
          </button>
        );
      })}
    </div>
  );
}
