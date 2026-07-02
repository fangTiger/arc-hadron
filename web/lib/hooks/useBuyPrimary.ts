"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "@/lib/contracts";
import { mapWagmiError } from "@/lib/purchase";

export type BuyPrimaryStatus = "idle" | "signing" | "pending" | "success" | "error";

export interface UseBuyPrimaryResult {
  buy: (offeringId: bigint, amount: bigint, totalValue: bigint) => void;
  status: BuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorZh?: string;
  reset: () => void;
}

export function useBuyPrimary(): UseBuyPrimaryResult {
  const [status, setStatus] = useState<BuyPrimaryStatus>("idle");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [errorZh, setErrorZh] = useState<string>();
  const busyRef = useRef(false);
  const { writeContract } = useWriteContract();

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash && status === "pending"),
    },
  });

  useEffect(() => {
    if (status !== "pending") {
      return;
    }

    if (receiptQuery.isError) {
      setErrorZh(mapWagmiError(receiptQuery.error));
      setStatus("error");
      busyRef.current = false;
      return;
    }

    if (!receiptQuery.data) {
      return;
    }

    if (receiptQuery.data.status === "success") {
      setStatus("success");
      busyRef.current = false;
      return;
    }

    setErrorZh("交易被链上回滚");
    setStatus("error");
    busyRef.current = false;
  }, [receiptQuery.data, receiptQuery.error, receiptQuery.isError, status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(undefined);
    setErrorZh(undefined);
    busyRef.current = false;
  }, []);

  const buy = useCallback(
    (offeringId: bigint, amount: bigint, totalValue: bigint) => {
      // React 状态更新不是同步完成，ref 用来挡住同一帧内的重复点击。
      if (busyRef.current || (status !== "idle" && status !== "error")) {
        return;
      }

      busyRef.current = true;
      setStatus("signing");
      setTxHash(undefined);
      setErrorZh(undefined);

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
            setErrorZh(mapWagmiError(err));
            setStatus("error");
            busyRef.current = false;
          },
          onSuccess: (hash) => {
            setTxHash(hash);
            setStatus("pending");
          },
        },
      );
    },
    [status, writeContract],
  );

  return { buy, status, txHash, errorZh, reset };
}
