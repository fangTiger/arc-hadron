"use client";

import type { MouseEvent } from "react";
import type { AssistantCommand } from "@/lib/assistant/commands";

export interface CommandMenuProps {
  highlightedIndex: number;
  items: AssistantCommand[];
  onSelect: (template: string) => void;
}

export function CommandMenu({ highlightedIndex, items, onSelect }: CommandMenuProps) {
  return (
    <div
      aria-label="Assistant commands"
      className="mb-3 overflow-hidden border border-border bg-panel shadow-xl shadow-bg/40"
      role="listbox"
    >
      {items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted">No matching commands</p>
      ) : (
        items.map((item, index) => {
          const isHighlighted = index === highlightedIndex;

          return (
            <button
              aria-selected={isHighlighted}
              className={[
                "flex w-full items-start justify-between gap-4 border-t border-border px-3 py-3 text-left first:border-t-0",
                "transition-colors duration-150",
                isHighlighted ? "bg-neon/10 text-text" : "bg-transparent text-text-dim hover:bg-bg/80",
              ].join(" ")}
              data-command={item.command}
              key={item.command}
              onClick={() => onSelect(item.template)}
              onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
              role="option"
              type="button"
            >
              <span>
                <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-neon">
                  /{item.command}
                </span>
                <span className="mt-1 block text-sm leading-5">{item.hint}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {item.label}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
