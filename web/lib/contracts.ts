import type { Abi } from "viem";
import HadronAssetsAbi from "./abi/HadronAssets.json";
import HadronMarketAbi from "./abi/HadronMarket.json";
import HadronYieldAbi from "./abi/HadronYield.json";
import { readAddressEnv } from "./env";

export const HADRON_ASSETS_ADDRESS = readAddressEnv(
  "NEXT_PUBLIC_HADRON_ASSETS",
  process.env.NEXT_PUBLIC_HADRON_ASSETS,
);

export const HADRON_MARKET_ADDRESS = readAddressEnv(
  "NEXT_PUBLIC_HADRON_MARKET",
  process.env.NEXT_PUBLIC_HADRON_MARKET,
);

export const HADRON_YIELD_ADDRESS = readAddressEnv(
  "NEXT_PUBLIC_HADRON_YIELD",
  process.env.NEXT_PUBLIC_HADRON_YIELD,
);

export const HADRON_ASSETS_ABI = HadronAssetsAbi as Abi;
export const HADRON_MARKET_ABI = HadronMarketAbi as Abi;
export const HADRON_YIELD_ABI = HadronYieldAbi as Abi;
