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
import { fetchLogsInBlockRange } from "@/lib/eventLogs";
import { toHoldings, type BuyEvent, type Holding, type TokenBalance } from "@/lib/mappers";
import { useAssets } from "./useAssets";

const PRIMARY_SALE_EVENT = parseAbiItem(
  "event PrimarySale(uint256 indexed offeringId, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPaid, uint256 fee)",
);
const BID_FILLED_EVENT = parseAbiItem(
  "event BidFilled(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, address seller, uint256 amount, uint256 totalPaid, uint256 fee)",
);
export const PORTFOLIO_READ_ERROR_ZH = "Failed to load portfolio data from Arc RPC.";

interface PortfolioBuyLog {
  args: {
    amount?: bigint;
    bidder?: `0x${string}`;
    buyer?: `0x${string}`;
    tokenId?: bigint;
    totalPaid?: bigint;
  };
}

export function portfolioBuyEventsFromLogs(logs: readonly PortfolioBuyLog[]): BuyEvent[] {
  return logs.flatMap((log) => {
    const { tokenId, amount, totalPaid } = log.args;

    if (tokenId === undefined || amount === undefined || totalPaid === undefined) {
      return [];
    }

    return [{ tokenId, amount, totalPaid }];
  });
}

export function usePortfolio(): { errorZh?: string; holdings: Holding[]; isLoading: boolean } {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { assets, errorZh: assetsErrorZh, isLoading: isAssetsLoading } = useAssets();
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

      const latestBlock = await publicClient.getBlockNumber();
      const [primarySaleLogs, bidFilledLogs] = await Promise.all([
        fetchLogsInBlockRange({
          fromBlock: BigInt(DEPLOY_BLOCK),
          getLogs: (chunk) =>
            publicClient.getLogs({
              address: HADRON_MARKET_ADDRESS,
              args: {
                buyer: address,
              },
              event: PRIMARY_SALE_EVENT,
              fromBlock: chunk.from,
              toBlock: chunk.to,
            }),
          toBlock: latestBlock,
        }),
        fetchLogsInBlockRange({
          fromBlock: BigInt(DEPLOY_BLOCK),
          getLogs: (chunk) =>
            publicClient.getLogs({
              address: HADRON_MARKET_ADDRESS,
              args: {
                bidder: address,
              },
              event: BID_FILLED_EVENT,
              fromBlock: chunk.from,
              toBlock: chunk.to,
            }),
          toBlock: latestBlock,
        }),
      ]);

      return portfolioBuyEventsFromLogs([
        ...(primarySaleLogs as readonly PortfolioBuyLog[]),
        ...(bidFilledLogs as readonly PortfolioBuyLog[]),
      ]);
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
  const errorZh =
    assetsErrorZh || balancesQuery.isError || buyEventsQuery.isError
      ? PORTFOLIO_READ_ERROR_ZH
      : undefined;

  return {
    errorZh,
    holdings,
    isLoading:
      !errorZh && (isAssetsLoading || balancesQuery.isLoading || buyEventsQuery.isLoading),
  };
}
