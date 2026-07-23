"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { WalletButton } from "./WalletButton";

const navItems = [
  { href: "/", label: "MARKET" },
  { href: "/portfolio", label: "PORTFOLIO" },
  { href: "/developers/api", label: "API" },
];

function NetworkBadge({ compact = false }: { compact?: boolean }) {
  const { isConnected, isCorrectChain, switchToArc } = useNetworkGuard();
  const dotClass = !isConnected ? "bg-muted" : isCorrectChain ? "bg-up" : "bg-down";

  return (
    <div
      className={[
        "flex shrink-0 items-center gap-2 border border-border bg-panel/70 font-mono text-[10px] uppercase text-text-dim",
        compact ? "px-2 py-1.5 tracking-[0.14em]" : "px-3 py-2 tracking-[0.2em]",
      ].join(" ")}
    >
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span>{compact ? "ARC" : "ARC TESTNET"}</span>
      {isConnected && !isCorrectChain ? (
        <button
          className="ml-1 text-down underline-offset-4 transition-colors duration-200 hover:text-text hover:underline"
          onClick={switchToArc}
          type="button"
        >
          {compact ? "Switch" : "Switch network"}
        </button>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-bg/88 backdrop-blur-xl"
      data-app-header
    >
      <div className="hadron-shell">
        <div className="flex h-14 min-w-0 items-center gap-3 lg:h-16 lg:gap-4">
          <Link
            className="inline-flex shrink-0 items-center gap-2 font-mono text-base font-semibold tracking-[0.2em] text-text sm:text-lg sm:tracking-[0.22em]"
            href="/"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="size-6 shrink-0"
              data-brand-mark
              height={24}
              src="/favicon.ico"
              width={24}
            />
            <span>HADRON</span>
          </Link>

          <div className="hidden h-5 w-px bg-border xl:block" />
          <p className="hidden text-[10px] uppercase tracking-[0.2em] text-text-dim xl:block">
            REAL-WORLD ASSET EXCHANGE ON ARC
          </p>

          <nav
            className="ml-auto hidden items-center gap-1 lg:flex"
            data-desktop-primary-navigation
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200",
                    isActive ? "text-neon" : "text-muted hover:text-text",
                  ].join(" ")}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 lg:ml-3">
            <AssistantDock />
            <div className="hidden lg:block xl:hidden">
              <NetworkBadge compact />
            </div>
            <div className="hidden xl:block">
              <NetworkBadge />
            </div>
            <WalletButton />
          </div>
        </div>

        <div className="flex h-10 min-w-0 items-center justify-between gap-3 border-t border-border/75 lg:hidden">
          <nav
            aria-label="Primary navigation"
            className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
            data-mobile-primary-navigation
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "shrink-0 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-200",
                    isActive ? "text-neon" : "text-muted hover:text-text",
                  ].join(" ")}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <NetworkBadge compact />
        </div>
      </div>
    </header>
  );
}
