"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useConnect } from "wagmi";
import { labelClassName } from "@/components/trading/ListForSaleForm";
import { GlowButton } from "@/components/ui/GlowButton";
import { buildTxExplorerUrl } from "@/components/ui/TxToast";
import { ARC_CHAIN_ID } from "@/lib/chain";
import type { TradeEvent } from "@/lib/events";
import { formatUsdc, parseUsdc, shortAddress } from "@/lib/format";
import { useDepositYield, useClaimYield, usePendingYield } from "@/lib/hooks/useYield";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { AssetView } from "@/lib/mappers";
import { GAS_BUFFER } from "@/lib/purchase";
import { addressExplorerUrl, eventExplorerUrl, relativeTime } from "@/lib/marketMetrics";

const RECENT_DISTRIBUTION_LIMIT = 5;

interface YieldPanelProps {
  asset: AssetView;
  events: TradeEvent[];
  initialDepositAmountInput?: string;
  initialIsDistributeOpen?: boolean;
  nowMs?: number;
}

type YieldTransactionStatus = ReturnType<typeof useClaimYield>["status"];

type DepositValidation =
  | { ok: true; amount: bigint }
  | { ok: false; errorText: string };

function isYieldBusy(status: YieldTransactionStatus): boolean {
  return status === "signing" || status === "pending";
}

function transactionLabel({
  defaultLabel,
  isBalanceLoading,
  isConnected,
  isCorrectChain,
  status,
}: {
  defaultLabel: string;
  isBalanceLoading?: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  status: YieldTransactionStatus;
}) {
  if (!isConnected) {
    return "CONNECT WALLET";
  }

  if (!isCorrectChain) {
    return "Switch to ARC TESTNET";
  }

  if (status === "signing") {
    return "Confirm in wallet...";
  }

  if (status === "pending") {
    return "Confirming on-chain...";
  }

  if (isBalanceLoading) {
    return "Loading balance...";
  }

  if (status === "success") {
    return defaultLabel;
  }

  if (status === "error") {
    return `Retry ${defaultLabel.toLowerCase()}`;
  }

  return defaultLabel;
}

function validateDepositAmount(amountInput: string, balance: bigint): DepositValidation {
  let amount: bigint;

  try {
    amount = parseUsdc(amountInput);
  } catch {
    return { ok: false, errorText: "Enter a valid USDC amount" };
  }

  if (amount === 0n) {
    return { ok: false, errorText: "Enter an amount greater than zero" };
  }

  if (amount + GAS_BUFFER > balance) {
    return { ok: false, errorText: "Insufficient USDC balance" };
  }

  return { ok: true, amount };
}

function sortedYieldDeposits(events: readonly TradeEvent[], tokenId: bigint): TradeEvent[] {
  return events
    .filter(
      (event) =>
        event.tokenId === tokenId &&
        event.type === "yield-deposited" &&
        event.yieldAmount !== undefined,
    )
    .sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        return b.logIndex - a.logIndex;
      }

      return a.blockNumber > b.blockNumber ? -1 : 1;
    });
}

function TransactionLink({ txHash }: { txHash?: `0x${string}` }) {
  if (!txHash) {
    return null;
  }

  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  return (
    <a
      className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
      href={buildTxExplorerUrl(explorerUrl, txHash)}
      rel="noreferrer"
      target="_blank"
    >
      {shortAddress(txHash)}
    </a>
  );
}

export function YieldPanel({
  asset,
  events,
  initialDepositAmountInput = "",
  initialIsDistributeOpen = false,
  nowMs = 0,
}: YieldPanelProps) {
  const [isDistributeOpen, setIsDistributeOpen] = useState(initialIsDistributeOpen);
  const [depositAmountInput, setDepositAmountInput] = useState(initialDepositAmountInput);
  const [walletError, setWalletError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const pendingYield = usePendingYield([asset.tokenId]);
  const {
    claim,
    errorText: claimErrorText,
    reset: resetClaim,
    status: claimStatus,
    txHash: claimTxHash,
  } = useClaimYield();
  const {
    deposit,
    errorText: depositErrorText,
    reset: resetDeposit,
    status: depositStatus,
    txHash: depositTxHash,
  } = useDepositYield();
  const queryClient = useQueryClient();
  const lastClaimRefreshKey = useRef<string | null>(null);
  const lastDepositRefreshKey = useRef<string | null>(null);
  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected" || connector.id === "injected"),
    [connectors],
  );
  const balanceQuery = useBalance({
    address,
    chainId: ARC_CHAIN_ID,
    query: {
      enabled: Boolean(address),
    },
  });
  const { refetch: refetchBalance } = balanceQuery;
  const balanceValue = balanceQuery.data?.value ?? 0n;
  const pendingAmount = pendingYield.pendingByTokenId.get(asset.tokenId) ?? 0n;
  const deposits = useMemo(
    () => sortedYieldDeposits(events, asset.tokenId),
    [asset.tokenId, events],
  );
  const recentDeposits = deposits.slice(0, RECENT_DISTRIBUTION_LIMIT);
  const totalDistributed = useMemo(
    () => deposits.reduce((total, event) => total + (event.yieldAmount ?? 0n), 0n),
    [deposits],
  );
  const depositValidation = useMemo(
    () =>
      isConnected && isCorrectChain && !balanceQuery.isLoading
        ? validateDepositAmount(depositAmountInput, balanceValue)
        : null,
    [
      balanceQuery.isLoading,
      balanceValue,
      depositAmountInput,
      isConnected,
      isCorrectChain,
    ],
  );

  useEffect(() => {
    if (claimStatus !== "success" || !claimTxHash) {
      return;
    }

    const key = `claim:${claimTxHash}`;

    if (lastClaimRefreshKey.current === key) {
      return;
    }

    lastClaimRefreshKey.current = key;
    void Promise.all([
      queryClient.invalidateQueries(),
      refetchBalance(),
    ]).catch(() => undefined);
  }, [claimStatus, claimTxHash, queryClient, refetchBalance]);

  useEffect(() => {
    if (depositStatus !== "success" || !depositTxHash) {
      return;
    }

    const key = `deposit:${depositTxHash}`;

    if (lastDepositRefreshKey.current === key) {
      return;
    }

    lastDepositRefreshKey.current = key;
    void Promise.all([
      queryClient.invalidateQueries(),
      refetchBalance(),
    ]).catch(() => undefined);
  }, [depositStatus, depositTxHash, queryClient, refetchBalance]);

  function connectWallet() {
    if (!injectedConnector) {
      setWalletError("Install MetaMask or a compatible injected wallet.");
      return;
    }

    connect(
      { connector: injectedConnector },
      {
        onError: () => setWalletError("Install MetaMask or unlock your wallet."),
      },
    );
  }

  function submitClaim() {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!isCorrectChain) {
      switchToArc();
      return;
    }

    if (pendingAmount === 0n || isYieldBusy(claimStatus)) {
      return;
    }

    claim(asset.tokenId);
  }

  function submitDeposit() {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!isCorrectChain) {
      switchToArc();
      return;
    }

    if (depositValidation?.ok !== true || isYieldBusy(depositStatus)) {
      return;
    }

    deposit(asset.tokenId, depositValidation.amount);
  }

  const pendingText = pendingYield.isLoading ? "Loading..." : `${formatUsdc(pendingAmount)} USDC`;
  const claimButtonLabel = isConnectPending
    ? "CONNECTING"
    : transactionLabel({
        defaultLabel: "CLAIM",
        isConnected,
        isCorrectChain,
        status: claimStatus,
      });
  const isClaimDisabled =
    isYieldBusy(claimStatus) ||
    pendingYield.isLoading ||
    (isConnected && isCorrectChain && pendingAmount === 0n);
  const validationError = depositValidation?.ok === false ? depositValidation.errorText : null;
  const depositButtonLabel = isConnectPending
    ? "CONNECTING"
    : transactionLabel({
        defaultLabel: "DEPOSIT",
        isBalanceLoading: balanceQuery.isLoading,
        isConnected,
        isCorrectChain,
        status: depositStatus,
      });
  const isDepositDisabled =
    isYieldBusy(depositStatus) ||
    balanceQuery.isLoading ||
    (isConnected && isCorrectChain && depositValidation?.ok !== true);
  const balanceText = !isConnected
    ? "Not connected"
    : balanceQuery.isLoading
      ? "Loading..."
      : `${formatUsdc(balanceValue)} USDC`;

  return (
    <section className="overflow-hidden border border-border bg-panel">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
            {asset.meta.ticker} / TOKEN #{asset.tokenId.toString()}
          </p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">
            YIELD
          </h2>
        </div>
        <button
          className="h-8 w-fit border border-border bg-bg/50 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text"
          onClick={() => {
            setIsDistributeOpen((current) => !current);
            resetDeposit();
          }}
          type="button"
        >
          Distribute
        </button>
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <div className="border border-border bg-bg/35 p-4">
            <p className={labelClassName()}>CLAIMABLE</p>
            {isConnected ? (
              <p className="mt-3 font-mono text-lg font-semibold tabular-nums text-text">
                Pending yield: {pendingText}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-text-dim">
                Connect wallet to view pending yield.
              </p>
            )}
            <div className="mt-4">
              <GlowButton
                className="w-full"
                disabled={isClaimDisabled}
                onClick={submitClaim}
                size="sm"
              >
                {claimButtonLabel}
              </GlowButton>
            </div>
            {claimStatus === "success" ? (
              <div className="mt-4 border border-up/70 bg-up/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">
                  Yield claimed
                </p>
                <TransactionLink txHash={claimTxHash} />
              </div>
            ) : null}
            {claimStatus === "error" ? (
              <div className="mt-4 border border-down/70 bg-down/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
                  {claimErrorText ?? "Transaction failed, please retry"}
                </p>
                <button
                  className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:text-text"
                  onClick={resetClaim}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 border border-border bg-bg/35">
            <div className="border-r border-border p-4">
              <p className={labelClassName()}>TOTAL DISTRIBUTED</p>
              <p className="mt-3 font-mono text-lg font-semibold tabular-nums text-gold">
                {formatUsdc(totalDistributed)} USDC
              </p>
            </div>
            <div className="p-4">
              <p className={labelClassName()}>RECORDS</p>
              <p className="mt-3 font-mono text-lg font-semibold tabular-nums text-text">
                {deposits.length}
              </p>
            </div>
          </div>

          {isDistributeOpen ? (
            <div className="border border-border bg-bg/35 p-4">
              <label className="block">
                <span className={labelClassName()}>DEPOSIT AMOUNT</span>
                <input
                  className="mt-3 h-11 w-full border border-border bg-bg px-3 font-mono text-base text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
                  disabled={isYieldBusy(depositStatus)}
                  inputMode="decimal"
                  onChange={(event) => setDepositAmountInput(event.target.value)}
                  placeholder="0.00"
                  value={depositAmountInput}
                />
              </label>
              {validationError ? (
                <p className="mt-3 text-sm leading-6 text-down">{validationError}</p>
              ) : null}
              <div className="mt-4 divide-y divide-border border-y border-border">
                <div className="flex items-center justify-between gap-4 py-3">
                  <p className={labelClassName()}>BALANCE</p>
                  <p className="font-mono text-sm text-text-dim">{balanceText}</p>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <p className={labelClassName()}>DEPOSIT VALUE</p>
                  <p className="font-mono text-sm text-text">
                    {depositValidation?.ok ? `${formatUsdc(depositValidation.amount)} USDC` : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <GlowButton
                  className="w-full"
                  disabled={isDepositDisabled}
                  onClick={submitDeposit}
                  size="sm"
                >
                  {depositButtonLabel}
                </GlowButton>
              </div>
              {depositStatus === "success" ? (
                <div className="mt-4 border border-up/70 bg-up/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">
                    Yield deposited
                  </p>
                  <TransactionLink txHash={depositTxHash} />
                </div>
              ) : null}
              {depositStatus === "error" ? (
                <div className="mt-4 border border-down/70 bg-down/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
                    {depositErrorText ?? "Transaction failed, please retry"}
                  </p>
                </div>
              ) : null}
              {walletError ? (
                <p className="mt-3 text-sm leading-6 text-down">{walletError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border border-border">
          <div className="border-b border-border bg-bg/60 px-4 py-3">
            <p className={labelClassName()}>RECENT DISTRIBUTIONS</p>
          </div>
          {recentDeposits.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">No yield distributions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentDeposits.map((event) => (
                <li
                  className="grid gap-3 px-4 py-3 transition-colors duration-200 hover:bg-border/20 sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={`${event.txHash}:${event.logIndex}`}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold">
                      YIELD DEPOSIT {formatUsdc(event.yieldAmount ?? 0n)} USDC
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      <span>{relativeTime(event.timestamp, nowMs)}</span>
                      {event.account ? (
                        <a
                          className="underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                          href={addressExplorerUrl(event.account)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          FROM {shortAddress(event.account)}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <a
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                    href={eventExplorerUrl(event.txHash)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {shortAddress(event.txHash)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
