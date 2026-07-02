import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { parseAbiItem, type Address } from "viem";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { DEPLOY_BLOCK } from "@/lib/chain";
import {
  HADRON_ASSETS_ABI,
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
} from "@/lib/contracts";
import { toHoldings, type BuyEvent, type Holding, type TokenBalance } from "@/lib/mappers";
import { useAssets } from "./useAssets";

const PRIMARY_SALE_EVENT = parseAbiItem(
  "event PrimarySale(uint256 indexed offeringId, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPaid, uint256 fee)",
);

export function usePortfolio(): { holdings: Holding[]; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { assets, isLoading: isAssetsLoading } = useAssets();
  const tokenIds = useMemo(() => assets.map((asset) => asset.tokenId), [assets]);

  const balancesQuery = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    functionName: "balanceOfBatch",
    args:
      address && tokenIds.length > 0
        ? [Array(tokenIds.length).fill(address) as Address[], tokenIds]
        : undefined,
    query: {
      enabled: Boolean(isConnected && address && tokenIds.length > 0),
      refetchInterval: 8000,
    },
  });

  const buyEventsQuery = useQuery({
    queryKey: ["primary-sale-events", address],
    enabled: Boolean(isConnected && address && publicClient),
    staleTime: 30_000,
    queryFn: async (): Promise<BuyEvent[]> => {
      if (!address || !publicClient) {
        return [];
      }

      const logs = await publicClient.getLogs({
        address: HADRON_MARKET_ADDRESS,
        event: PRIMARY_SALE_EVENT,
        args: {
          buyer: address,
        },
        fromBlock: BigInt(DEPLOY_BLOCK),
      });

      return logs.flatMap((log) => {
        const { tokenId, amount, totalPaid } = log.args;

        if (tokenId === undefined || amount === undefined || totalPaid === undefined) {
          return [];
        }

        return [{ tokenId, amount, totalPaid }];
      });
    },
  });

  const holdings = useMemo(() => {
    if (!isConnected || !address) {
      return [];
    }

    const balances = ((balancesQuery.data ?? []) as bigint[]).map<TokenBalance>((balance, index) => ({
      tokenId: tokenIds[index],
      balance,
    }));

    return toHoldings(assets, balances, buyEventsQuery.data ?? []);
  }, [address, assets, balancesQuery.data, buyEventsQuery.data, isConnected, tokenIds]);

  return {
    holdings,
    isLoading: isAssetsLoading || balancesQuery.isLoading || buyEventsQuery.isLoading,
  };
}
