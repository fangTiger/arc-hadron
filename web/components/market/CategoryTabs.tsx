"use client";

import { CATEGORY_TAB_OPTIONS, type MarketCategory } from "@/lib/categories";

export type { MarketCategory } from "@/lib/categories";

export function CategoryTabs({
  onChange,
  value,
}: {
  onChange: (value: MarketCategory) => void;
  value: MarketCategory;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_TAB_OPTIONS.map((category) => {
        const active = value === category.value;

        return (
          <button
            className={[
              "h-9 border px-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors",
              active
                ? "border-border-glow bg-neon/10 text-neon"
                : "border-border bg-panel/60 text-muted hover:border-border-glow hover:text-text",
            ].join(" ")}
            key={category.value}
            onClick={() => onChange(category.value)}
            type="button"
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
