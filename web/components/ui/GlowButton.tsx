import type { ButtonHTMLAttributes, ReactNode } from "react";

type GlowButtonSize = "sm" | "md";

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: GlowButtonSize;
}

const sizeClass: Record<GlowButtonSize, string> = {
  sm: "h-8 px-3 text-[10px]",
  md: "h-10 px-5 text-[11px]",
};

export function glowButtonClassName({
  className = "",
  disabled,
  size = "md",
}: {
  className?: string;
  disabled?: boolean;
  size?: GlowButtonSize;
} = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center border border-neon/50",
    "font-mono font-semibold uppercase tracking-[0.2em]",
    "transition-[background,border-color,box-shadow,color,opacity] duration-200",
    sizeClass[size],
    disabled
      ? "cursor-not-allowed border-border bg-muted/30 text-text-dim shadow-none"
      : "bg-linear-to-r from-neon to-neon-dim text-bg shadow-[0_0_24px_rgba(34,211,238,0.32)] hover:border-neon hover:shadow-[0_0_34px_rgba(34,211,238,0.48)]",
    className,
  ].join(" ");
}

export function GlowButton({
  children,
  className = "",
  disabled,
  size = "md",
  type = "button",
  ...props
}: GlowButtonProps) {
  return (
    <button
      className={glowButtonClassName({ className, disabled, size })}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
