"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount, WagmiProvider } from "wagmi";
import { ToastProvider } from "@/components/ui/TxToast";
import { useEventDrivenInvalidation } from "@/lib/hooks/useEventDrivenInvalidation";
import { initializeHadronAppKit } from "@/lib/wagmi";
import { wagmiConfig } from "@/lib/wagmi";

function EventDrivenInvalidatorMount(): null {
  const { address } = useAccount();

  useEventDrivenInvalidation({ me: address });

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  // QueryClient 绑定到单个浏览器会话，避免 SSR/请求之间共享缓存。
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            staleTime: 5_000,
          },
        },
      }),
  );

  useEffect(() => {
    initializeHadronAppKit();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <EventDrivenInvalidatorMount />
          {children}
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
