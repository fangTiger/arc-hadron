"use client";

import { useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/format";
import { GlowButton } from "@/components/ui/GlowButton";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected" || connector.id === "injected"),
    [connectors],
  );

  function connectWallet() {
    setNotice(null);

    if (!injectedConnector) {
      setNotice("请安装 MetaMask 或兼容 injected 钱包。");
      return;
    }

    connect(
      { connector: injectedConnector },
      {
        onError: () => setNotice("请安装 MetaMask 或确认钱包已解锁。"),
      },
    );
  }

  async function copyAddress() {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setNotice("地址已复制。");
    } catch {
      setNotice("复制失败，请手动复制地址。");
    }
  }

  if (!isConnected || !address) {
    return (
      <div className="relative flex flex-col items-end gap-1">
        <GlowButton disabled={isPending} onClick={connectWallet} size="sm">
          {isPending ? "CONNECTING" : "CONNECT WALLET"}
        </GlowButton>
        {notice ? (
          <p className="absolute right-0 top-10 w-56 border border-border bg-panel px-3 py-2 text-right text-[11px] text-text-dim">
            {notice}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-8 border border-border-glow bg-panel/80 px-3 font-mono text-[11px] text-neon-dim transition-colors hover:border-neon"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {shortAddress(address)}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-10 z-50 min-w-36 border border-border bg-panel/95 p-1 text-[12px] text-text shadow-xl shadow-bg/40"
          role="menu"
        >
          <button
            className="block w-full px-3 py-2 text-left text-text-dim transition-colors hover:bg-border/40 hover:text-text"
            onClick={copyAddress}
            role="menuitem"
            type="button"
          >
            复制地址
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-down transition-colors hover:bg-border/40"
            onClick={() => {
              disconnect();
              setIsOpen(false);
            }}
            role="menuitem"
            type="button"
          >
            断开连接
          </button>
          {notice ? <p className="border-t border-border px-3 py-2 text-[11px] text-text-dim">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
