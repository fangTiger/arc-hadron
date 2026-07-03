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
  isClosing?: boolean;
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
const TOAST_EXIT_MS = 180;
const ToastContext = createContext<ToastContextValue | null>(null);

export function buildTxExplorerUrl(explorerUrl: string, txHash: string): string {
  return `${explorerUrl.trim().replace(/\/+$/, "")}/tx/${txHash}`;
}

export function toastMotionClassName(isClosing: boolean, hasEntered = true): string {
  return [
    "hadron-toast transform-gpu transition-[opacity,transform] ease-out",
    "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
    isClosing || !hasEntered
      ? "translate-y-2 opacity-0 duration-150 ease-in"
      : "translate-y-0 opacity-100 duration-200",
  ].join(" ");
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
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHasEntered(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (toast.isClosing) {
      return undefined;
    }

    const timeout = window.setTimeout(() => onClose(toast.id), TOAST_TTL_MS);

    return () => window.clearTimeout(timeout);
  }, [onClose, toast.id, toast.isClosing]);

  return (
    <div
      className={[
        "pointer-events-auto w-full border bg-panel/95 p-4 shadow-xl shadow-bg/40",
        borderClass,
        toastMotionClassName(Boolean(toast.isClosing), hasEntered),
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${labelClass}`}>
            {toast.kind === "success" ? "SUCCESS" : "ERROR"}
          </p>
          <p className="mt-2 text-sm leading-6 text-text">{toast.message}</p>
          {toast.kind === "success" && toast.txHash ? (
            <a
              className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
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
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-text"
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
  const closeTimers = useRef<Map<string, number>>(new Map());
  const nextId = useRef(0);

  const deleteToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const removeToast = useCallback(
    (id: string) => {
      if (closeTimers.current.has(id)) {
        return;
      }

      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast)),
      );

      const timeout = window.setTimeout(() => {
        closeTimers.current.delete(id);
        deleteToast(id);
      }, TOAST_EXIT_MS);

      closeTimers.current.set(id, timeout);
    },
    [deleteToast],
  );

  const pushToast = useCallback((toast: Omit<ToastEntry, "id">) => {
    const id = `${Date.now()}-${nextId.current}`;
    nextId.current += 1;

    setToasts((current) => [...current, { ...toast, id, isClosing: false }].slice(-5));
  }, []);

  useEffect(
    () => () => {
      closeTimers.current.forEach((timeout) => window.clearTimeout(timeout));
      closeTimers.current.clear();
    },
    [],
  );

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
