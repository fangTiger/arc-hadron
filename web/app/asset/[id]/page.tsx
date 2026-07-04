"use client";

import { useParams } from "next/navigation";
import { AssetDetailView } from "./AssetDetailView";
import { useAssets } from "@/lib/hooks/useAssets";
import { useListings } from "@/lib/hooks/useListings";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";

export default function AssetDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { assets, errorZh, isLoading } = useAssets();
  const { events, isLoading: isEventsLoading, nowMs } = useMarketEvents();
  const selectedAsset = assets.find((item) => item.tokenId.toString() === id);
  const { listings: assetListings } = useListings(selectedAsset?.tokenId ?? null);

  return (
    <AssetDetailView
      assetListings={assetListings}
      assets={assets}
      errorZh={errorZh}
      events={events}
      id={id}
      isEventsLoading={isEventsLoading}
      isLoading={isLoading}
      nowMs={nowMs}
    />
  );
}
