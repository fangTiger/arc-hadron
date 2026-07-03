"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  HADRON_ASSETS_ABI,
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ABI,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import type { ListForSaleStatus } from "@/lib/hooks/useListForSale";
import { mapWagmiError } from "@/lib/purchase";

interface FillBidIntent {
  bidId: bigint;
  amount: bigint;
}

interface FillBidLocalState {
  status: ListForSaleStatus;
  txHash?: `0x${string}`;
  approveTxHash?: `0x${string}`;
  errorText?: string;
}

interface ReceiptState {
  error?: unknown;
  isError: boolean;
  status?: "success" | "reverted";
}

export interface UseFillBidResult {
  fillBid: (bidId: bigint, amount: bigint) => void;
  status: ListForSaleStatus;
  txHash?: `0x${string}`;
  approveTxHash?: `0x${string}`;
  errorText?: string;
  reset: () => void;
}

function deriveReceiptStatus({
  error,
  isError,
  status,
}: ReceiptState): { status?: "success"; errorText?: string } {
  if (isError) {
    return { errorText: mapWagmiError(error) };
  }

  if (status === "reverted") {
    return { errorText: "Transaction reverted on-chain" };
  }

  if (status === "success") {
    return { status: "success" };
  }

  return {};
}

function deriveFillBidState({
  approvalReceipt,
  fillReceipt,
  localState,
}: {
  approvalReceipt: ReceiptState;
  fillReceipt: ReceiptState;
  localState: FillBidLocalState;
}): { status: ListForSaleStatus; errorText?: string } {
  if (localState.status === "approve-pending") {
    const receiptState = deriveReceiptStatus(approvalReceipt);

    if (receiptState.errorText) {
      return { status: "error", errorText: receiptState.errorText };
    }
  }

  if (localState.status === "pending") {
    const receiptState = deriveReceiptStatus(fillReceipt);

    if (receiptState.errorText) {
      return { status: "error", errorText: receiptState.errorText };
    }

    if (receiptState.status === "success") {
      return { status: "success" };
    }
  }

  return { status: localState.status, errorText: localState.errorText };
}

export function useFillBid(): UseFillBidResult {
  const { address } = useAccount();
  const [localState, setLocalState] = useState<FillBidLocalState>({ status: "idle" });
  const busyRef = useRef(false);
  const intentRef = useRef<FillBidIntent | null>(null);
  const { writeContract } = useWriteContract();
  const { refetch: refetchApproval } = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    functionName: "isApprovedForAll",
    args: address ? [address, HADRON_MARKET_ADDRESS] : undefined,
    query: {
      enabled: Boolean(address),
      refetchInterval: 8000,
    },
  });
  const approveTxHash = localState.approveTxHash;
  const txHash = localState.txHash;
  const approvalReceiptQuery = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: {
      enabled: Boolean(approveTxHash && localState.status === "approve-pending"),
    },
  });
  const fillReceiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash && localState.status === "pending"),
    },
  });
  const derivedState = useMemo(
    () =>
      deriveFillBidState({
        approvalReceipt: {
          error: approvalReceiptQuery.error,
          isError: approvalReceiptQuery.isError,
          status: approvalReceiptQuery.data?.status,
        },
        fillReceipt: {
          error: fillReceiptQuery.error,
          isError: fillReceiptQuery.isError,
          status: fillReceiptQuery.data?.status,
        },
        localState,
      }),
    [
      approvalReceiptQuery.data?.status,
      approvalReceiptQuery.error,
      approvalReceiptQuery.isError,
      fillReceiptQuery.data?.status,
      fillReceiptQuery.error,
      fillReceiptQuery.isError,
      localState,
    ],
  );
  const status = derivedState.status;
  const errorText = derivedState.errorText;

  const failWithError = useCallback((err: unknown) => {
    setLocalState((previous) => ({
      status: "error",
      approveTxHash: previous.approveTxHash,
      txHash: previous.txHash,
      errorText: mapWagmiError(err),
    }));
    busyRef.current = false;
  }, []);

  const failWithText = useCallback((errorText: string) => {
    setLocalState((previous) => ({
      status: "error",
      approveTxHash: previous.approveTxHash,
      txHash: previous.txHash,
      errorText,
    }));
    busyRef.current = false;
  }, []);

  const submitFill = useCallback(() => {
    const intent = intentRef.current;

    if (!intent) {
      failWithText("Transaction failed, please retry");
      return;
    }

    setLocalState((previous) => ({
      status: "signing",
      approveTxHash: previous.approveTxHash,
    }));

    writeContract(
      {
        abi: HADRON_MARKET_ABI,
        address: HADRON_MARKET_ADDRESS,
        functionName: "fillBid",
        args: [intent.bidId, intent.amount],
      },
      {
        onError: failWithError,
        onSuccess: (hash) => {
          setLocalState((previous) => ({
            status: "pending",
            approveTxHash: previous.approveTxHash,
            txHash: hash,
          }));
        },
      },
    );
  }, [failWithError, failWithText, writeContract]);

  const submitApproval = useCallback(() => {
    setLocalState({ status: "approving" });

    writeContract(
      {
        abi: HADRON_ASSETS_ABI,
        address: HADRON_ASSETS_ADDRESS,
        functionName: "setApprovalForAll",
        args: [HADRON_MARKET_ADDRESS, true],
      },
      {
        onError: failWithError,
        onSuccess: (hash) => {
          setLocalState({ status: "approve-pending", approveTxHash: hash });
        },
      },
    );
  }, [failWithError, writeContract]);

  const reset = useCallback(() => {
    intentRef.current = null;
    setLocalState({ status: "idle" });
    busyRef.current = false;
  }, []);

  const fillBid = useCallback(
    (bidId: bigint, amount: bigint) => {
      if (
        (busyRef.current && status === "idle") ||
        (status !== "idle" && status !== "error")
      ) {
        return;
      }

      if (!address) {
        setLocalState({ status: "error", errorText: "Connect wallet to continue" });
        return;
      }

      intentRef.current = { amount, bidId };
      busyRef.current = true;
      setLocalState({ status: "checking" });

      void refetchApproval()
        .then((result) => {
          if (result.isError) {
            failWithError(result.error);
            return;
          }

          if (result.data === true) {
            submitFill();
            return;
          }

          submitApproval();
        })
        .catch(failWithError);
    },
    [address, failWithError, refetchApproval, status, submitApproval, submitFill],
  );

  useEffect(() => {
    if (localState.status !== "approve-pending") {
      return;
    }

    if (approvalReceiptQuery.data?.status === "success") {
      submitFill();
    }
  }, [approvalReceiptQuery.data?.status, localState.status, submitFill]);

  return {
    approveTxHash,
    errorText,
    fillBid,
    reset,
    status,
    txHash,
  };
}
