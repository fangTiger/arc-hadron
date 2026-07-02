"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { deriveBuyPrimaryState, type BuyPrimaryStatus } from "@/lib/hooks/useBuyPrimary";
import { mapWagmiError } from "@/lib/purchase";

interface BuyListingLocalState {
  status: Exclude<BuyPrimaryStatus, "success">;
  txHash?: `0x${string}`;
  errorText?: string;
}

export interface UseBuyListingResult {
  buy: (listingId: bigint, amount: bigint, totalValue: bigint) => void;
  status: BuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorText?: string;
  reset: () => void;
}

export function useBuyListing(): UseBuyListingResult {
  const [localState, setLocalState] = useState<BuyListingLocalState>({ status: "idle" });
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
    (listingId: bigint, amount: bigint, totalValue: bigint) => {
      if ((busyRef.current && status === "idle") || (status !== "idle" && status !== "error")) {
        return;
      }

      busyRef.current = true;
      setLocalState({ status: "signing" });

      writeContract(
        {
          abi: HADRON_MARKET_ABI,
          address: HADRON_MARKET_ADDRESS,
          functionName: "buy",
          args: [listingId, amount],
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
