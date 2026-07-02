import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/chain";

export function useNetworkGuard(): {
  isConnected: boolean;
  isCorrectChain: boolean;
  switchToArc: () => void;
} {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  return {
    isConnected,
    isCorrectChain: isConnected && chainId === ARC_CHAIN_ID,
    switchToArc: () => switchChain({ chainId: ARC_CHAIN_ID }),
  };
}
