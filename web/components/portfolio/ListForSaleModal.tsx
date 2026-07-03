"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  defaultListingAmountInput,
  formatListingPriceInput,
  labelClassName,
  ListForSaleForm,
  listingProceeds,
  type TxHash,
} from "@/components/trading/ListForSaleForm";
import { useToast } from "@/components/ui/TxToast";
import { formatShares } from "@/lib/format";
import { useListForSale, type ListForSaleStatus } from "@/lib/hooks/useListForSale";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { Holding } from "@/lib/mappers";

export { defaultListingAmountInput, formatListingPriceInput, listingProceeds };

export interface ListForSaleModalViewProps {
  amountInput: string;
  approveTxHash?: TxHash;
  errorText?: string;
  explorerUrl: string;
  holding: Holding;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onPriceChange?: (value: string) => void;
  onSubmit: (amount: bigint, pricePerShare: bigint) => void;
  priceInput: string;
  status: ListForSaleStatus;
  txHash?: TxHash;
}

export function ListForSaleModalView({
  amountInput,
  approveTxHash,
  errorText,
  explorerUrl,
  holding,
  onAmountChange,
  onClose,
  onPriceChange = () => undefined,
  onSubmit,
  priceInput,
  status,
  txHash,
}: ListForSaleModalViewProps) {
  const maxAmountInput = defaultListingAmountInput(holding.balance);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 px-4 py-8 backdrop-blur-sm">
      <section
        aria-modal="true"
        className="w-full max-w-xl border border-border bg-panel p-5 shadow-2xl shadow-bg/60"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className={labelClassName()}>LIST FOR SALE</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">
              {holding.asset.meta.displayName}
            </h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
              BALANCE {formatShares(holding.balance)} {holding.asset.meta.ticker}
            </p>
          </div>
          <button
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-text"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <ListForSaleForm
          amountInput={amountInput}
          approveTxHash={approveTxHash}
          balance={holding.balance}
          errorText={errorText}
          explorerUrl={explorerUrl}
          maxAmountInput={maxAmountInput}
          onAmountChange={onAmountChange}
          onMaxAmount={() => onAmountChange(maxAmountInput)}
          onPriceChange={onPriceChange}
          onSubmit={onSubmit}
          priceInput={priceInput}
          status={status}
          txHash={txHash}
        />
      </section>
    </div>
  );
}

export function ListForSaleModal({
  holding,
  onClose,
}: {
  holding: Holding;
  onClose: () => void;
}) {
  const [amountInput, setAmountInput] = useState(() => defaultListingAmountInput(holding.balance));
  const [priceInput, setPriceInput] = useState(
    holding.asset.offering ? formatListingPriceInput(holding.asset.offering.pricePerShare) : "",
  );
  const { approveTxHash, errorText, listForSale, reset, status, txHash } = useListForSale();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { pushError, pushSuccess } = useToast();
  const queryClient = useQueryClient();
  const lastNoticeKey = useRef<string | null>(null);
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  useEffect(() => {
    if (status === "success" && txHash) {
      const key = `success:${txHash}`;

      if (lastNoticeKey.current !== key) {
        pushSuccess({ message: "Listing created", txHash });
        lastNoticeKey.current = key;
        void queryClient.invalidateQueries().catch(() => undefined);
        reset();
        onClose();
      }

      return;
    }

    if (status === "error" && errorText) {
      const key = `error:${errorText}:${txHash ?? approveTxHash ?? ""}`;

      if (lastNoticeKey.current !== key) {
        pushError(errorText);
        lastNoticeKey.current = key;
      }

      return;
    }

    lastNoticeKey.current = null;
  }, [
    approveTxHash,
    errorText,
    onClose,
    pushError,
    pushSuccess,
    queryClient,
    reset,
    status,
    txHash,
  ]);

  function closeModal() {
    reset();
    onClose();
  }

  return (
    <ListForSaleModalView
      amountInput={amountInput}
      approveTxHash={approveTxHash}
      errorText={errorText}
      explorerUrl={explorerUrl}
      holding={holding}
      onAmountChange={setAmountInput}
      onClose={closeModal}
      onPriceChange={setPriceInput}
      onSubmit={(amount, pricePerShare) => {
        // 错误网络必须先切链，禁止发起交易（trading-flow 规范）。
        if (!isCorrectChain) {
          switchToArc();
          return;
        }

        listForSale(holding.asset.tokenId, amount, pricePerShare);
      }}
      priceInput={priceInput}
      status={status}
      txHash={txHash}
    />
  );
}
