"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { WalletButton } from "./WalletButton";

const navItems = [
  { href: "/", label: "MARKET" },
  { href: "/portfolio", label: "PORTFOLIO" },
];

function NetworkBadge() {
  const { isConnected, isCorrectChain, switchToArc } = useNetworkGuard();
  const dotClass = !isConnected ? "bg-muted" : isCorrectChain ? "bg-up" : "bg-down";

  return (
    <div className="flex items-center gap-2 border border-border bg-panel/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span>ARC TESTNET</span>
      {isConnected && !isCorrectChain ? (
        <button className="ml-1 text-down underline-offset-4 hover:underline" onClick={switchToArc} type="button">
          切换网络
        </button>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="font-mono text-lg font-semibold tracking-[0.25em] text-text" href="/">
          HADRON<span className="text-neon">.</span>
        </Link>

        <div className="hidden h-5 w-px bg-border md:block" />
        <p className="hidden text-[10px] uppercase tracking-[0.2em] text-text-dim md:block">
          REAL-WORLD ASSET EXCHANGE ON ARC
        </p>

        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                className={[
                  "px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors",
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

        <div className="ml-auto flex items-center gap-2 sm:ml-3">
          <NetworkBadge />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
