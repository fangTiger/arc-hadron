import { defineChain } from "viem";
import { parsePublicIntEnv, requirePublicEnv } from "./env";

export const ARC_CHAIN_ID = parsePublicIntEnv(
  "NEXT_PUBLIC_ARC_CHAIN_ID",
  process.env.NEXT_PUBLIC_ARC_CHAIN_ID,
);

export const ARC_RPC_URL = requirePublicEnv(
  "NEXT_PUBLIC_ARC_RPC_URL",
  process.env.NEXT_PUBLIC_ARC_RPC_URL,
);

export const ARC_EXPLORER_URL = requirePublicEnv(
  "NEXT_PUBLIC_ARC_EXPLORER_URL",
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL,
);

export const DEPLOY_BLOCK = parsePublicIntEnv(
  "NEXT_PUBLIC_DEPLOY_BLOCK",
  process.env.NEXT_PUBLIC_DEPLOY_BLOCK,
);

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: ARC_EXPLORER_URL,
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
  testnet: true,
});
