import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "soft";
}

export function Skeleton({ className = "", tone = "default", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "hadron-skeleton relative overflow-hidden border border-border",
        tone === "soft" ? "bg-panel/70" : "bg-panel",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-linear-to-r before:from-transparent before:via-neon/10 before:to-transparent before:content-['']",
        "before:animate-[hadron-skeleton_1.8s_ease-in-out_infinite]",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
