"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import {
  AssistantPanelView,
  type AssistantCard,
  type AssistantDepthLevel,
} from "@/components/assistant/AssistantPanel";
import { useToast } from "@/components/ui/TxToast";
import { matchAsset, parseIntent, type Intent } from "@/lib/ai/intent";
import {
  assistantDefaultAssetForPath,
  buildAssistantIntentRequest,
} from "@/lib/ai/assistantContext";
import { resolveBuy, type ResolveBuyResult } from "@/lib/ai/resolveBuy";
import { resolveCancelableOrders, type CancelableOrder } from "@/lib/ai/resolveCancelable";
import { resolveClaimable } from "@/lib/ai/resolveClaimable";
import { buildOrderBook } from "@/lib/orderBook";
import { useBuyListing } from "@/lib/hooks/useBuyListing";
import { useBuyPrimary } from "@/lib/hooks/useBuyPrimary";
import { useCancelBid } from "@/lib/hooks/useCancelBid";
import { useCancelListing } from "@/lib/hooks/useCancelListing";
import { useAllBids } from "@/lib/hooks/useBids";
import { useAssets } from "@/lib/hooks/useAssets";
import { useAllListings } from "@/lib/hooks/useListings";
import { useListForSale } from "@/lib/hooks/useListForSale";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { useClaimYield, usePendingYield } from "@/lib/hooks/useYield";
import type { BidView } from "@/lib/bids";
import type { ListingView } from "@/lib/listing";
import type { AssetView, Holding } from "@/lib/mappers";
import type { ClaimConfirmEntry } from "@/components/assistant/ClaimConfirmCard";

function assetLabel(asset: AssetView): string {
  return asset.meta.ticker || asset.meta.displayName || asset.name;
}

function candidateLabel(asset: AssetView) {
  return {
    tokenId: asset.tokenId,
    label: asset.meta.displayName || asset.name,
    ticker: asset.meta.ticker,
  };
}

function listingsForAsset(tokenId: bigint, listings: readonly ListingView[]): ListingView[] {
  return listings.filter((listing) => listing.tokenId === tokenId);
}

function bidsForAsset(tokenId: bigint, bids: readonly BidView[]): BidView[] {
  return bids.filter((bid) => bid.tokenId === tokenId);
}

function holdingBalance(tokenId: bigint, holdings: readonly Holding[]): bigint {
  return holdings.find((holding) => holding.asset.tokenId === tokenId)?.balance ?? 0n;
}

function bestAsk(tokenId: bigint, listings: readonly ListingView[]): bigint | null {
  return listingsForAsset(tokenId, listings)[0]?.pricePerShare ?? null;
}

function bestBid(tokenId: bigint, bids: readonly BidView[]): bigint | null {
  return bidsForAsset(tokenId, bids)[0]?.pricePerShare ?? null;
}

function depthLevels(levels: Array<{ price: bigint; size: bigint }>): AssistantDepthLevel[] {
  return levels.slice(0, 5).map((level) => ({
    price: level.price,
    size: level.size,
  }));
}

function assetMatchCard(query: string, assets: readonly AssetView[]): AssistantCard | AssetView {
  const match = matchAsset(query, assets);

  if (match === null) {
    return { type: "asset_not_found", query };
  }

  if (match.type === "ambiguous") {
    return {
      type: "asset_ambiguous",
      query,
      candidates: match.candidates.map(candidateLabel),
    };
  }

  return match.asset;
}

function holdingsCard({
  assetQuery,
  assets,
  holdings,
  isConnected,
}: {
  assetQuery?: string;
  assets: readonly AssetView[];
  holdings: readonly Holding[];
  isConnected: boolean;
}): AssistantCard {
  if (!assetQuery) {
    return {
      type: "holdings",
      isConnected,
      rows: holdings.map((holding) => ({
        assetLabel: assetLabel(holding.asset),
        balance: holding.balance,
        marketValue: holding.marketValue,
      })),
    };
  }

  const matchedAsset = assetMatchCard(assetQuery, assets);

  if ("type" in matchedAsset) {
    return matchedAsset;
  }

  return {
    type: "holdings",
    isConnected,
    rows: holdings
      .filter((holding) => holding.asset.tokenId === matchedAsset.tokenId)
      .map((holding) => ({
        assetLabel: assetLabel(holding.asset),
        balance: holding.balance,
        marketValue: holding.marketValue,
      })),
  };
}

function yieldCard({
  assets,
  isConnected,
  pendingByTokenId,
  totalPending,
}: {
  assets: readonly AssetView[];
  isConnected: boolean;
  pendingByTokenId: Map<bigint, bigint>;
  totalPending: bigint;
}): AssistantCard {
  return {
    type: "yield",
    isConnected,
    totalPending,
    rows: assets
      .map((asset) => ({
        assetLabel: assetLabel(asset),
        pending: pendingByTokenId.get(asset.tokenId) ?? 0n,
      }))
      .filter((row) => row.pending > 0n),
  };
}

interface BuyDraft {
  asset: AssetView;
  resolution: ResolveBuyResult;
}

interface SellDraft {
  asset: AssetView;
  balance: bigint;
  price?: number;
  quantity: number;
}

interface CancelDraft {
  asset: AssetView;
  orders: CancelableOrder[];
}

interface ClaimDraft {
  entries: ClaimConfirmEntry[];
  mode: "single" | "batch";
}

interface IntentCardsResult {
  cards: AssistantCard[];
  buyDraft: BuyDraft | null;
  sellDraft: SellDraft | null;
  cancelDraft: CancelDraft | null;
  claimDraft: ClaimDraft | null;
}

const EMPTY_DRAFTS = {
  buyDraft: null,
  sellDraft: null,
  cancelDraft: null,
  claimDraft: null,
} as const;

function claimEntries(
  entries: Array<{ tokenId: bigint; amount: bigint }>,
  assets: readonly AssetView[],
): ClaimConfirmEntry[] {
  const assetByTokenId = new Map(assets.map((asset) => [asset.tokenId, asset]));

  return entries.map((entry) => {
    const asset = assetByTokenId.get(entry.tokenId);

    return {
      tokenId: entry.tokenId,
      amount: entry.amount,
      assetLabel: asset ? assetLabel(asset) : `TOKEN #${entry.tokenId.toString()}`,
    };
  });
}

function cardsForIntent({
  address,
  assets,
  bids,
  holdings,
  intent,
  isConnected,
  listings,
  pendingByTokenId,
  pending,
  totalPending,
}: {
  address?: `0x${string}`;
  assets: readonly AssetView[];
  bids: readonly BidView[];
  holdings: readonly Holding[];
  intent: Intent;
  isConnected: boolean;
  listings: readonly ListingView[];
  pending: Array<{ tokenId: bigint; amount: bigint }>;
  pendingByTokenId: Map<bigint, bigint>;
  totalPending: bigint;
}): IntentCardsResult {
  switch (intent.kind) {
    case "query_price": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], ...EMPTY_DRAFTS };
      }

      return {
        cards: [
          {
            type: "price",
            assetLabel: assetLabel(matchedAsset),
            primaryPrice: matchedAsset.offering?.pricePerShare ?? null,
            bestAsk: bestAsk(matchedAsset.tokenId, listings),
            bestBid: bestBid(matchedAsset.tokenId, bids),
          },
        ],
        ...EMPTY_DRAFTS,
      };
    }
    case "query_depth": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], ...EMPTY_DRAFTS };
      }

      const book = buildOrderBook({
        bids: bidsForAsset(matchedAsset.tokenId, bids),
        listings: listingsForAsset(matchedAsset.tokenId, listings),
      });

      return {
        cards: [
          {
            type: "depth",
            assetLabel: assetLabel(matchedAsset),
            asks: depthLevels(book.asks),
            bids: depthLevels(book.bids),
          },
        ],
        ...EMPTY_DRAFTS,
      };
    }
    case "query_holdings":
      return {
        cards: [holdingsCard({ assetQuery: intent.asset, assets, holdings, isConnected })],
        ...EMPTY_DRAFTS,
      };
    case "query_yield":
      return {
        cards: [yieldCard({ assets, isConnected, pendingByTokenId, totalPending })],
        ...EMPTY_DRAFTS,
      };
    case "buy": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], ...EMPTY_DRAFTS };
      }

      return {
        cards: [],
        sellDraft: null,
        cancelDraft: null,
        claimDraft: null,
        buyDraft: {
          asset: matchedAsset,
          resolution: resolveBuy(matchedAsset.tokenId, intent.quantity, {
            primaryOffering: matchedAsset.offering,
            listings: listingsForAsset(matchedAsset.tokenId, listings),
          }),
        },
      };
    }
    case "sell": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], ...EMPTY_DRAFTS };
      }

      return {
        cards: [],
        buyDraft: null,
        cancelDraft: null,
        claimDraft: null,
        sellDraft: {
          asset: matchedAsset,
          balance: holdingBalance(matchedAsset.tokenId, holdings),
          price: intent.price,
          quantity: intent.quantity,
        },
      };
    }
    case "cancel": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], ...EMPTY_DRAFTS };
      }

      return {
        cards: [],
        buyDraft: null,
        sellDraft: null,
        claimDraft: null,
        cancelDraft: {
          asset: matchedAsset,
          orders: address
            ? resolveCancelableOrders(matchedAsset.tokenId, address, {
                listings: listingsForAsset(matchedAsset.tokenId, listings),
                bids: bidsForAsset(matchedAsset.tokenId, bids),
              })
            : [],
        },
      };
    }
    case "claim": {
      if (intent.asset) {
        const matchedAsset = assetMatchCard(intent.asset, assets);

        if ("type" in matchedAsset) {
          return { cards: [matchedAsset], ...EMPTY_DRAFTS };
        }

        const result = resolveClaimable(address, {
          pending,
          asset: matchedAsset.tokenId,
        });

        return {
          cards: [],
          buyDraft: null,
          sellDraft: null,
          cancelDraft: null,
          claimDraft: {
            mode: "single",
            entries: claimEntries(result.entries, assets),
          },
        };
      }

      const result = resolveClaimable(address, { pending });

      return {
        cards: [],
        buyDraft: null,
        sellDraft: null,
        cancelDraft: null,
        claimDraft: {
          mode: "batch",
          entries: claimEntries(result.entries, assets),
        },
      };
    }
    case "unknown":
      return { cards: [{ type: "unknown" }], ...EMPTY_DRAFTS };
  }
}

export function AssistantDock() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { pushError, pushSuccess } = useToast();
  const queryClient = useQueryClient();
  const { assets } = useAssets();
  const { listings } = useAllListings();
  const { bids } = useAllBids();
  const { holdings } = usePortfolio();
  const tokenIds = useMemo(() => assets.map((asset) => asset.tokenId), [assets]);
  const { pending, pendingByTokenId, totalPending } = usePendingYield(tokenIds);
  const buyPrimary = useBuyPrimary();
  const buyListing = useBuyListing();
  const listForSale = useListForSale();
  const cancelListing = useCancelListing();
  const cancelBid = useCancelBid();
  const claimYield = useClaimYield();
  const defaultAsset = assistantDefaultAssetForPath(pathname, assets);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [cards, setCards] = useState<AssistantCard[]>([]);
  const [buyDraft, setBuyDraft] = useState<BuyDraft | null>(null);
  const [sellDraft, setSellDraft] = useState<SellDraft | null>(null);
  const [cancelDraft, setCancelDraft] = useState<CancelDraft | null>(null);
  const [claimDraft, setClaimDraft] = useState<ClaimDraft | null>(null);
  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected" || connector.id === "injected"),
    [connectors],
  );

  useEffect(() => {
    if (buyPrimary.status === "success" && buyPrimary.txHash) {
      pushSuccess({ message: "Purchase successful", txHash: buyPrimary.txHash });
      void queryClient.invalidateQueries();
    } else if (buyPrimary.status === "error" && buyPrimary.errorText) {
      pushError(buyPrimary.errorText);
    }
  }, [buyPrimary.errorText, buyPrimary.status, buyPrimary.txHash, pushError, pushSuccess, queryClient]);

  useEffect(() => {
    if (buyListing.status === "success" && buyListing.txHash) {
      pushSuccess({ message: "Purchase successful", txHash: buyListing.txHash });
      void queryClient.invalidateQueries();
    } else if (buyListing.status === "error" && buyListing.errorText) {
      pushError(buyListing.errorText);
    }
  }, [buyListing.errorText, buyListing.status, buyListing.txHash, pushError, pushSuccess, queryClient]);

  useEffect(() => {
    if (listForSale.status === "success" && listForSale.txHash) {
      pushSuccess({ message: "Listing created", txHash: listForSale.txHash });
      void queryClient.invalidateQueries();
    } else if (listForSale.status === "error" && listForSale.errorText) {
      pushError(listForSale.errorText);
    }
  }, [listForSale.errorText, listForSale.status, listForSale.txHash, pushError, pushSuccess, queryClient]);

  useEffect(() => {
    if (cancelListing.status === "success" && cancelListing.txHash) {
      pushSuccess({ message: "Order cancelled", txHash: cancelListing.txHash });
      void queryClient.invalidateQueries();
    } else if (cancelListing.status === "error" && cancelListing.errorText) {
      pushError(cancelListing.errorText);
    }
  }, [
    cancelListing.errorText,
    cancelListing.status,
    cancelListing.txHash,
    pushError,
    pushSuccess,
    queryClient,
  ]);

  useEffect(() => {
    if (cancelBid.status === "success" && cancelBid.txHash) {
      pushSuccess({ message: "Order cancelled", txHash: cancelBid.txHash });
      void queryClient.invalidateQueries();
    } else if (cancelBid.status === "error" && cancelBid.errorText) {
      pushError(cancelBid.errorText);
    }
  }, [cancelBid.errorText, cancelBid.status, cancelBid.txHash, pushError, pushSuccess, queryClient]);

  useEffect(() => {
    if (claimYield.status === "success" && claimYield.txHash) {
      pushSuccess({ message: "Yield claimed", txHash: claimYield.txHash });
      void queryClient.invalidateQueries();
    } else if (claimYield.status === "error" && claimYield.errorText) {
      pushError(claimYield.errorText);
    }
  }, [claimYield.errorText, claimYield.status, claimYield.txHash, pushError, pushSuccess, queryClient]);

  function connectWallet() {
    if (!injectedConnector) {
      pushError("Install MetaMask or a compatible injected wallet.");
      return;
    }

    connect(
      { connector: injectedConnector },
      {
        onError: () => pushError("Install MetaMask or unlock your wallet."),
      },
    );
  }

  async function submit() {
    const request = buildAssistantIntentRequest(inputValue, defaultAsset);

    if (!request.message) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    setBuyDraft(null);
    setSellDraft(null);
    setCancelDraft(null);
    setClaimDraft(null);

    try {
      const response = await fetch("/api/ai/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        setErrorText("Assistant request failed");
        return;
      }

      const intent = parseIntent(await response.json());
      const next = cardsForIntent({
        address,
        assets,
        bids,
        holdings,
        intent,
        isConnected,
        listings,
        pending,
        pendingByTokenId,
        totalPending,
      });

      setCards(next.cards);
      setBuyDraft(next.buyDraft);
      setSellDraft(next.sellDraft);
      setCancelDraft(next.cancelDraft);
      setClaimDraft(next.claimDraft);
      setInputValue("");
    } catch {
      setErrorText("Assistant request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const buyCard: AssistantCard[] = buyDraft
    ? [
        {
          type: "buy",
          assetLabel: assetLabel(buyDraft.asset),
          errorText:
            buyDraft.resolution.kind !== "unavailable" && buyDraft.resolution.source.type === "primary"
              ? buyPrimary.errorText
              : buyListing.errorText,
          isConnected: Boolean(isConnected && address),
          isCorrectChain,
          onBuyListing: buyListing.buy,
          onBuyPrimary: buyPrimary.buy,
          onConnect: connectWallet,
          onSwitchNetwork: switchToArc,
          resolution: buyDraft.resolution,
          status:
            buyDraft.resolution.kind !== "unavailable" && buyDraft.resolution.source.type === "primary"
              ? buyPrimary.status
              : buyListing.status,
          txHash:
            buyDraft.resolution.kind !== "unavailable" && buyDraft.resolution.source.type === "primary"
              ? buyPrimary.txHash
              : buyListing.txHash,
        },
      ]
    : [];
  const sellCard: AssistantCard[] = sellDraft
    ? [
        {
          type: "sell",
          assetLabel: assetLabel(sellDraft.asset),
          balance: sellDraft.balance,
          errorText: listForSale.errorText,
          isConnected: Boolean(isConnected && address),
          isCorrectChain,
          onConnect: connectWallet,
          onListForSale: listForSale.listForSale,
          onSwitchNetwork: switchToArc,
          price: sellDraft.price,
          quantity: sellDraft.quantity,
          status: listForSale.status,
          tokenId: sellDraft.asset.tokenId,
          txHash: listForSale.txHash,
        },
      ]
    : [];
  const activeCancel =
    cancelListing.status !== "idle" || cancelListing.errorText ? cancelListing : cancelBid;
  const cancelCard: AssistantCard[] = cancelDraft
    ? [
        {
          type: "cancel",
          assetLabel: assetLabel(cancelDraft.asset),
          errorText: activeCancel.errorText,
          isConnected: Boolean(isConnected && address),
          isCorrectChain,
          onCancelBid: cancelBid.cancelBid,
          onCancelListing: cancelListing.cancel,
          onConnect: connectWallet,
          onSwitchNetwork: switchToArc,
          orders: cancelDraft.orders,
          status: activeCancel.status,
          txHash: activeCancel.txHash,
        },
      ]
    : [];
  const claimCard: AssistantCard[] = claimDraft
    ? [
        {
          type: "claim",
          entries: claimDraft.entries,
          errorText: claimYield.errorText,
          isConnected: Boolean(isConnected && address),
          isCorrectChain,
          mode: claimDraft.mode,
          onClaim: claimYield.claim,
          onClaimBatch: claimYield.claimBatch,
          onConnect: connectWallet,
          onSwitchNetwork: switchToArc,
          status: claimYield.status,
          txHash: claimYield.txHash,
        },
      ]
    : [];

  return (
    <>
      <button
        className="h-9 border border-border bg-panel/70 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-neon/50 hover:text-neon"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        ASSISTANT
      </button>
      <AssistantPanelView
        cards={[...cards, ...buyCard, ...sellCard, ...cancelCard, ...claimCard]}
        defaultAssetLabel={defaultAsset ? assetLabel(defaultAsset) : null}
        errorText={errorText}
        inputValue={inputValue}
        isOpen={isOpen}
        isSubmitting={isSubmitting}
        onClose={() => setIsOpen(false)}
        onInputChange={setInputValue}
        onSubmit={() => void submit()}
      />
    </>
  );
}
