"use client";

import { useMemo, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/format";
import { isAppKitConfigured } from "@/lib/appkit";
import { initializeHadronAppKit } from "@/lib/wagmi";
import { GlowButton } from "@/components/ui/GlowButton";

type OpenAppKitModal = () => Promise<unknown>;

export async function openWalletModal(
  open: OpenAppKitModal,
  setNotice: (notice: string | null) => void,
) {
  setNotice(null);

  try {
    await open();
  } catch {
    setNotice("Wallet modal failed to open. Please retry.");
  }
}

interface WalletButtonViewProps {
  address?: string;
  isConnected: boolean;
  isOpen: boolean;
  isPending: boolean;
  notice: string | null;
  onCopyAddress: () => void;
  onDisconnect: () => void;
  onOpenWallet: () => void;
  onToggleMenu: () => void;
}

export function WalletButtonView({
  address,
  isConnected,
  isOpen,
  isPending,
  notice,
  onCopyAddress,
  onDisconnect,
  onOpenWallet,
  onToggleMenu,
}: WalletButtonViewProps) {
  if (!isConnected || !address) {
    return (
      <div className="relative flex flex-col items-end gap-1">
        <GlowButton disabled={isPending} onClick={onOpenWallet} size="sm">
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
        onClick={onToggleMenu}
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
            onClick={onCopyAddress}
            role="menuitem"
            type="button"
          >
            Copy address
          </button>
          <button
            className="block w-full px-3 py-2 text-left text-down transition-colors hover:bg-border/40"
            onClick={onDisconnect}
            role="menuitem"
            type="button"
          >
            Disconnect
          </button>
          {notice ? <p className="border-t border-border px-3 py-2 text-[11px] text-text-dim">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function WalletButtonWithAppKit() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function connectWallet() {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    try {
      await openWalletModal(() => open(), setNotice);
    } finally {
      setIsOpening(false);
    }
  }

  async function copyAddress() {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setNotice("Address copied.");
    } catch {
      setNotice("Copy failed. Copy the address manually.");
    }
  }

  return (
    <WalletButtonView
      address={address}
      isConnected={isConnected}
      isOpen={isOpen}
      isPending={isOpening}
      notice={notice}
      onCopyAddress={copyAddress}
      onDisconnect={() => {
        disconnect();
        setIsOpen(false);
      }}
      onOpenWallet={connectWallet}
      onToggleMenu={() => setIsOpen((value) => !value)}
    />
  );
}

function WalletButtonWithInjectedFallback() {
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
      setNotice("WalletConnect is not configured. Install MetaMask or a compatible injected wallet.");
      return;
    }

    connect(
      { connector: injectedConnector },
      {
        onError: () => setNotice("Injected wallet connection failed. Please retry."),
      },
    );
  }

  async function copyAddress() {
    if (!address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setNotice("Address copied.");
    } catch {
      setNotice("Copy failed. Copy the address manually.");
    }
  }

  return (
    <WalletButtonView
      address={address}
      isConnected={isConnected}
      isOpen={isOpen}
      isPending={isPending}
      notice={notice}
      onCopyAddress={copyAddress}
      onDisconnect={() => {
        disconnect();
        setIsOpen(false);
      }}
      onOpenWallet={connectWallet}
      onToggleMenu={() => setIsOpen((value) => !value)}
    />
  );
}

export function WalletButton() {
  if (!isAppKitConfigured) {
    return <WalletButtonWithInjectedFallback />;
  }

  if (typeof window === "undefined" || !initializeHadronAppKit()) {
    return (
      <WalletButtonView
        address={undefined}
        isConnected={false}
        isOpen={false}
        isPending={false}
        notice={null}
        onCopyAddress={() => undefined}
        onDisconnect={() => undefined}
        onOpenWallet={() => undefined}
        onToggleMenu={() => undefined}
      />
    );
  }

  return <WalletButtonWithAppKit />;
}
