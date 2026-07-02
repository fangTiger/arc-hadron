import type { AssetMeta } from "./metadata";

export interface ChainAsset {
  tokenId: bigint;
  name: string;
  category: string;
  totalShares: bigint;
  metadataURI: string;
}

export interface ChainOffering {
  id: bigint;
  tokenId: bigint;
  pricePerShare: bigint;
  remaining: bigint;
  active: boolean;
}

export interface AssetView {
  tokenId: bigint;
  name: string;
  category: string;
  totalShares: bigint;
  meta: AssetMeta;
  offering: ChainOffering | null;
}

export interface Holding {
  asset: AssetView;
  balance: bigint;
  marketValue: bigint;
  costBasis: bigint | null;
  avgCost: bigint | null;
}

export interface TokenBalance {
  tokenId: bigint;
  balance: bigint;
}

export interface BuyEvent {
  tokenId: bigint;
  amount: bigint;
  totalPaid: bigint;
}

function slugFromMetadataURI(uri: string): string {
  const prefix = "hadron://assets/";

  if (uri.startsWith(prefix)) {
    return uri.slice(prefix.length);
  }

  return uri;
}

export function joinAssetsWithOfferings(
  assets: ChainAsset[],
  offerings: ChainOffering[],
  metaResolver: (uri: string) => AssetMeta,
): AssetView[] {
  const activeOfferingByTokenId = new Map<bigint, ChainOffering>();

  for (const offering of offerings) {
    if (!offering.active) {
      continue;
    }

    const current = activeOfferingByTokenId.get(offering.tokenId);

    if (!current || offering.id > current.id) {
      activeOfferingByTokenId.set(offering.tokenId, offering);
    }
  }

  return assets.map((asset) => ({
    tokenId: asset.tokenId,
    name: asset.name,
    category: asset.category,
    totalShares: asset.totalShares,
    meta: metaResolver(slugFromMetadataURI(asset.metadataURI)),
    offering: activeOfferingByTokenId.get(asset.tokenId) ?? null,
  }));
}

export function computeStats(views: AssetView[]): { tvl: bigint; avgApyBps: number | null } {
  let tvl = 0n;
  let apySum = 0;
  let apyCount = 0;

  for (const view of views) {
    if (view.offering) {
      tvl += view.totalShares * view.offering.pricePerShare;
    }

    if (view.meta.apyBps !== null) {
      apySum += view.meta.apyBps;
      apyCount += 1;
    }
  }

  return {
    tvl,
    avgApyBps: apyCount === 0 ? null : Math.floor(apySum / apyCount),
  };
}

export function toHoldings(
  views: AssetView[],
  balances: TokenBalance[],
  buyEvents: BuyEvent[],
): Holding[] {
  const viewByTokenId = new Map(views.map((view) => [view.tokenId, view]));
  const costByTokenId = new Map<bigint, { amount: bigint; totalPaid: bigint }>();

  for (const event of buyEvents) {
    if (event.amount <= 0n) {
      continue;
    }

    const current = costByTokenId.get(event.tokenId) ?? { amount: 0n, totalPaid: 0n };
    current.amount += event.amount;
    current.totalPaid += event.totalPaid;
    costByTokenId.set(event.tokenId, current);
  }

  return balances
    .filter((entry) => entry.balance > 0n)
    .flatMap((entry) => {
      const asset = viewByTokenId.get(entry.tokenId);

      if (!asset) {
        return [];
      }

      const pricePerShare = asset.offering?.pricePerShare ?? 0n;
      const marketValue = entry.balance * pricePerShare;
      const cost = costByTokenId.get(entry.tokenId);
      const avgCost = cost && cost.amount > 0n ? cost.totalPaid / cost.amount : null;

      return [
        {
          asset,
          balance: entry.balance,
          marketValue,
          avgCost,
          costBasis: avgCost === null ? null : avgCost * entry.balance,
        },
      ];
    });
}
