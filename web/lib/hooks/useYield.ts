"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  HADRON_YIELD_ABI,
  HADRON_YIELD_ADDRESS,
} from "@/lib/contracts";
import { deriveBuyPrimaryState, type BuyPrimaryStatus } from "@/lib/hooks/useBuyPrimary";
import { mapWagmiError } from "@/lib/purchase";

const REFETCH_INTERVAL_MS = 8000;

type LocalYieldTransactionStatus = Exclude<BuyPrimaryStatus, "success">;

interface YieldTransactionLocalState {
  status: LocalYieldTransactionStatus;
  txHash?: `0x${string}`;
  errorText?: string;
}

interface YieldWriteRequest {
  functionName: "depositYield" | "claimYield" | "claimYieldBatch";
  args: readonly unknown[];
  value?: bigint;
}

export interface PendingYield {
  tokenId: bigint;
  amount: bigint;
}

export interface UsePendingYieldResult {
  pending: PendingYield[];
  pendingByTokenId: Map<bigint, bigint>;
  totalPending: bigint;
  isLoading: boolean;
}

export interface UseDepositYieldResult {
  deposit: (tokenId: bigint, amount: bigint) => void;
  status: BuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorText?: string;
  reset: () => void;
}

export interface UseClaimYieldResult {
  claim: (tokenId: bigint) => void;
  claimBatch: (tokenIds: bigint[]) => void;
  status: BuyPrimaryStatus;
  txHash?: `0x${string}`;
  errorText?: string;
  reset: () => void;
}

function uniqueTokenIds(tokenIds: readonly bigint[]): bigint[] {
  return Array.from(new Set(tokenIds));
}

function useYieldTransaction() {
  const [localState, setLocalState] = useState<YieldTransactionLocalState>({ status: "idle" });
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

  const submit = useCallback(
    ({ args, functionName, value }: YieldWriteRequest) => {
      if ((busyRef.current && status === "idle") || (status !== "idle" && status !== "error")) {
        return;
      }

      busyRef.current = true;
      setLocalState({ status: "signing" });

      writeContract(
        {
          abi: HADRON_YIELD_ABI,
          address: HADRON_YIELD_ADDRESS,
          functionName,
          args,
          value,
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

  return { errorText, reset, status, submit, txHash };
}

export function usePendingYield(tokenIds: bigint[]): UsePendingYieldResult {
  const { address, isConnected } = useAccount();
  const activeTokenIds = useMemo(() => uniqueTokenIds(tokenIds), [tokenIds]);
  const canRead = Boolean(isConnected && address && activeTokenIds.length > 0);
  const contracts = useMemo(
    () =>
      canRead
        ? activeTokenIds.map((tokenId) => ({
            address: HADRON_YIELD_ADDRESS,
            abi: HADRON_YIELD_ABI,
            functionName: "pendingYield",
            args: [address, tokenId],
          }))
        : [],
    [activeTokenIds, address, canRead],
  );
  const pendingQuery = useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: canRead,
      refetchInterval: REFETCH_INTERVAL_MS,
    },
  });
  const pending = useMemo<PendingYield[]>(
    () =>
      contracts.map((_, index) => ({
        tokenId: activeTokenIds[index],
        amount: (pendingQuery.data?.[index] as bigint | undefined) ?? 0n,
      })),
    [activeTokenIds, contracts, pendingQuery.data],
  );
  const pendingByTokenId = useMemo(
    () => new Map(pending.map((item) => [item.tokenId, item.amount])),
    [pending],
  );
  const totalPending = useMemo(
    () => pending.reduce((sum, item) => sum + item.amount, 0n),
    [pending],
  );

  return {
    pending,
    pendingByTokenId,
    totalPending,
    isLoading: canRead && pendingQuery.isLoading,
  };
}

export function useDepositYield(): UseDepositYieldResult {
  const { errorText, reset, status, submit, txHash } = useYieldTransaction();
  const deposit = useCallback(
    (tokenId: bigint, amount: bigint) => {
      submit({
        args: [tokenId],
        functionName: "depositYield",
        value: amount,
      });
    },
    [submit],
  );

  return { deposit, errorText, reset, status, txHash };
}

export function useClaimYield(): UseClaimYieldResult {
  const { errorText, reset, status, submit, txHash } = useYieldTransaction();
  const claim = useCallback(
    (tokenId: bigint) => {
      submit({
        args: [tokenId],
        functionName: "claimYield",
      });
    },
    [submit],
  );
  const claimBatch = useCallback(
    (tokenIds: bigint[]) => {
      submit({
        args: [tokenIds],
        functionName: "claimYieldBatch",
      });
    },
    [submit],
  );

  return { claim, claimBatch, errorText, reset, status, txHash };
}
