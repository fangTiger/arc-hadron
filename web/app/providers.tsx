"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/ui/TxToast";
import { initializeHadronAppKit } from "@/lib/wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  // QueryClient 绑定到单个浏览器会话，避免 SSR/请求之间共享缓存。
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    initializeHadronAppKit();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
