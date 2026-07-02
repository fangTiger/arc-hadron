"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { mapWagmiError } from "@/lib/purchase";

export type BuyPrimaryStatus = "idle" | "signing" | "pending" | "success" | "error";
type LocalBuyPrimaryStatus = Exclude<BuyPrimaryStatus, "success">;

interface BuyPrimaryLocalState {
  status: LocalBuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorText?: string;
}

interface DeriveBuyPrimaryStateInput {
  localStatus: BuyPrimaryStatus;
  localErrorText?: string;
  receiptError?: unknown;
  receiptStatus?: "success" | "reverted";
}

export interface UseBuyPrimaryResult {
  buy: (offeringId: bigint, amount: bigint, totalValue: bigint) => void;
  status: BuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorText?: string;
  reset: () => void;
}

export function deriveBuyPrimaryState({
  localErrorText,
  localStatus,
  receiptError,
  receiptStatus,
}: DeriveBuyPrimaryStateInput): { status: BuyPrimaryStatus; errorText?: string } {
  if (localStatus !== "pending") {
    return { status: localStatus, errorText: localErrorText };
  }

  if (receiptError) {
    return { status: "error", errorText: mapWagmiError(receiptError) };
  }

  if (receiptStatus === "success") {
    return { status: "success" };
  }

  if (receiptStatus === "reverted") {
    return { status: "error", errorText: "Transaction reverted on-chain" };
  }

  return { status: "pending" };
}

export function useBuyPrimary(): UseBuyPrimaryResult {
  const [localState, setLocalState] = useState<BuyPrimaryLocalState>({ status: "idle" });
  const busyRef = useRef(false);
  const { writeContract } = useWriteContract();
  const txHash = localState.txHash;

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash && localState.status === "pending"),
    },
  });

  const derivedState = useMemo(
    () =>
      deriveBuyPrimaryState({
        localErrorText: localState.errorText,
        localStatus: localState.status,
        receiptError: receiptQuery.isError ? receiptQuery.error : undefined,
        receiptStatus: receiptQuery.data?.status,
      }),
    [localState.errorText, localState.status, receiptQuery.data?.status, receiptQuery.error, receiptQuery.isError],
  );
  const status = derivedState.status;
  const errorText = derivedState.errorText;

  const reset = useCallback(() => {
    setLocalState({ status: "idle" });
    busyRef.current = false;
  }, []);

  const buy = useCallback(
    (offeringId: bigint, amount: bigint, totalValue: bigint) => {
      // React 状态更新不是同步完成，ref 用来挡住同一帧内的重复点击。
      if ((busyRef.current && status === "idle") || (status !== "idle" && status !== "error")) {
        return;
      }

      busyRef.current = true;
      setLocalState({ status: "signing" });

      writeContract(
        {
          abi: HADRON_MARKET_ABI,
          address: HADRON_MARKET_ADDRESS,
          functionName: "buyPrimary",
          args: [offeringId, amount],
          value: totalValue,
        },
        {
          onError: (err) => {
            setLocalState({ status: "error", errorText: mapWagmiError(err) });
            busyRef.current = false;
          },
          onSuccess: (hash) => {
            setLocalState({ status: "pending", txHash: hash });
          },
        },
      );
    },
    [status, writeContract],
  );

  return { buy, status, txHash, errorText, reset };
}
