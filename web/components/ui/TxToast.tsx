"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error";

interface ToastEntry {
  id: string;
  kind: ToastKind;
  message: string;
  txHash?: `0x${string}`;
}

interface PushSuccessInput {
  message: string;
  txHash?: `0x${string}`;
}

interface ToastContextValue {
  pushSuccess: (input: PushSuccessInput) => void;
  pushError: (message: string) => void;
}

const TOAST_TTL_MS = 6000;
const ToastContext = createContext<ToastContextValue | null>(null);

export function buildTxExplorerUrl(explorerUrl: string, txHash: string): string {
  return `${explorerUrl.trim().replace(/\/+$/, "")}/tx/${txHash}`;
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastEntry;
  onClose: (id: string) => void;
}) {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";
  const borderClass = toast.kind === "success" ? "border-up/70" : "border-down/70";
  const labelClass = toast.kind === "success" ? "text-up" : "text-down";

  useEffect(() => {
    const timeout = window.setTimeout(() => onClose(toast.id), TOAST_TTL_MS);

    return () => window.clearTimeout(timeout);
  }, [onClose, toast.id]);

  return (
    <div className={`pointer-events-auto w-full border ${borderClass} bg-panel/95 p-4 shadow-xl shadow-bg/40`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${labelClass}`}>
            {toast.kind === "success" ? "SUCCESS" : "ERROR"}
          </p>
          <p className="mt-2 text-sm leading-6 text-text">{toast.message}</p>
          {toast.kind === "success" && toast.txHash ? (
            <a
              className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
              href={buildTxExplorerUrl(explorerUrl, toast.txHash)}
              rel="noreferrer"
              target="_blank"
            >
              View transaction
            </a>
          ) : null}
        </div>
        <button
          aria-label="Close notification"
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-text"
          onClick={() => onClose(toast.id)}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastEntry, "id">) => {
    const id = `${Date.now()}-${nextId.current}`;
    nextId.current += 1;

    setToasts((current) => [...current, { ...toast, id }].slice(-5));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushSuccess: ({ message, txHash }) => pushToast({ kind: "success", message, txHash }),
      pushError: (message) => pushToast({ kind: "error", message }),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} onClose={removeToast} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return value;
}
