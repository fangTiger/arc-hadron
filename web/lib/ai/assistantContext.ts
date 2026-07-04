import type { AssetView } from "@/lib/mappers";

export function assistantDefaultAssetForPath(
  pathname: string,
  assets: readonly AssetView[],
): AssetView | null {
  const match = pathname.match(/^\/asset\/(\d+)(?:\/)?$/);
  const tokenId = match?.[1];

  if (!tokenId) {
    return null;
  }

  return assets.find((asset) => asset.tokenId.toString() === tokenId) ?? null;
}

export function buildAssistantIntentRequest(message: string, defaultAsset: AssetView | null) {
  const trimmedMessage = message.trim();

  if (!defaultAsset) {
    return { message: trimmedMessage };
  }

  return {
    message: trimmedMessage,
    defaultAsset: defaultAsset.meta.ticker || defaultAsset.name,
  };
}
