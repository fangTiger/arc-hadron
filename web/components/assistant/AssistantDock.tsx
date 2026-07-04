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
import { buildOrderBook } from "@/lib/orderBook";
import { useBuyListing } from "@/lib/hooks/useBuyListing";
import { useBuyPrimary } from "@/lib/hooks/useBuyPrimary";
import { useAllBids } from "@/lib/hooks/useBids";
import { useAssets } from "@/lib/hooks/useAssets";
import { useAllListings } from "@/lib/hooks/useListings";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { usePendingYield } from "@/lib/hooks/useYield";
import type { BidView } from "@/lib/bids";
import type { ListingView } from "@/lib/listing";
import type { AssetView, Holding } from "@/lib/mappers";

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

function cardsForReadIntent({
  assets,
  bids,
  holdings,
  intent,
  isConnected,
  listings,
  pendingByTokenId,
  totalPending,
}: {
  assets: readonly AssetView[];
  bids: readonly BidView[];
  holdings: readonly Holding[];
  intent: Intent;
  isConnected: boolean;
  listings: readonly ListingView[];
  pendingByTokenId: Map<bigint, bigint>;
  totalPending: bigint;
}): { cards: AssistantCard[]; buyDraft: { asset: AssetView; resolution: ResolveBuyResult } | null } {
  switch (intent.kind) {
    case "query_price": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], buyDraft: null };
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
        buyDraft: null,
      };
    }
    case "query_depth": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], buyDraft: null };
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
        buyDraft: null,
      };
    }
    case "query_holdings":
      return {
        cards: [holdingsCard({ assetQuery: intent.asset, assets, holdings, isConnected })],
        buyDraft: null,
      };
    case "query_yield":
      return {
        cards: [yieldCard({ assets, isConnected, pendingByTokenId, totalPending })],
        buyDraft: null,
      };
    case "buy": {
      const matchedAsset = assetMatchCard(intent.asset, assets);

      if ("type" in matchedAsset) {
        return { cards: [matchedAsset], buyDraft: null };
      }

      return {
        cards: [],
        buyDraft: {
          asset: matchedAsset,
          resolution: resolveBuy(matchedAsset.tokenId, intent.quantity, {
            primaryOffering: matchedAsset.offering,
            listings: listingsForAsset(matchedAsset.tokenId, listings),
          }),
        },
      };
    }
    case "unknown":
      return { cards: [{ type: "unknown" }], buyDraft: null };
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
  const { pendingByTokenId, totalPending } = usePendingYield(tokenIds);
  const buyPrimary = useBuyPrimary();
  const buyListing = useBuyListing();
  const defaultAsset = assistantDefaultAssetForPath(pathname, assets);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [cards, setCards] = useState<AssistantCard[]>([]);
  const [buyDraft, setBuyDraft] = useState<{ asset: AssetView; resolution: ResolveBuyResult } | null>(null);
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
      const next = cardsForReadIntent({
        assets,
        bids,
        holdings,
        intent,
        isConnected,
        listings,
        pendingByTokenId,
        totalPending,
      });

      setCards(next.cards);
      setBuyDraft(next.buyDraft);
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
        cards={[...cards, ...buyCard]}
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
