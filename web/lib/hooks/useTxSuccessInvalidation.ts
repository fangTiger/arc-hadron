"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  applyTxInvalidation,
  type TxIntent,
} from "@/lib/hooks/applyTxInvalidation";

interface TxSuccessInvalidationState {
  handledTxHash?: `0x${string}`;
  status: string;
  txHash?: `0x${string}`;
}

interface UseTxSuccessInvalidationOptions {
  intent: TxIntent;
  status: string;
  txHash?: `0x${string}`;
}

export function shouldApplyTxSuccessInvalidation({
  handledTxHash,
  status,
  txHash,
}: TxSuccessInvalidationState): boolean {
  return status === "success" && txHash !== undefined && txHash !== handledTxHash;
}

export function useTxSuccessInvalidation({
  intent,
  status,
  txHash,
}: UseTxSuccessInvalidationOptions): void {
  const queryClient = useQueryClient();
  const handledTxHashRef = useRef<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    if (
      !shouldApplyTxSuccessInvalidation({
        handledTxHash: handledTxHashRef.current,
        status,
        txHash,
      })
    ) {
      return;
    }

    handledTxHashRef.current = txHash;
    applyTxInvalidation(queryClient, intent);
  }, [intent, queryClient, status, txHash]);
}
