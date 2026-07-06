"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 border border-border bg-panel px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors duration-200 hover:border-neon/50 hover:text-neon"
    >
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
