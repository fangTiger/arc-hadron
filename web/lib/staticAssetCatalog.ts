import type { ChainAsset } from "./mappers";

export const STATIC_ASSET_CATALOG: readonly ChainAsset[] = [
  {
    tokenId: 1n,
    name: "US T-BILL 2026-Q3",
    category: "treasuries",
    totalShares: 1_000_000n,
    metadataURI: "hadron://assets/t-bill-2026-q3",
  },
  {
    tokenId: 2n,
    name: "GOLD OUNCE VAULT #4",
    category: "gold",
    totalShares: 50_000n,
    metadataURI: "hadron://assets/gold-ounce-4",
  },
  {
    tokenId: 3n,
    name: "MARINA TOWER UNIT 12F",
    category: "real-estate",
    totalShares: 200_000n,
    metadataURI: "hadron://assets/marina-tower-12f",
  },
  {
    tokenId: 4n,
    name: "VERRA CARBON LOT-9",
    category: "carbon",
    totalShares: 800_000n,
    metadataURI: "hadron://assets/verra-carbon-9",
  },
  {
    tokenId: 5n,
    name: "US T-Note 2028",
    category: "treasuries",
    totalShares: 1_000_000n,
    metadataURI: "hadron://assets/us-t-note-2028",
  },
  {
    tokenId: 6n,
    name: "Meridian SME Credit Pool A",
    category: "private-credit",
    totalShares: 500_000n,
    metadataURI: "hadron://assets/meridian-sme-credit-a",
  },
  {
    tokenId: 7n,
    name: "Atlas Trade Receivables B",
    category: "private-credit",
    totalShares: 600_000n,
    metadataURI: "hadron://assets/atlas-trade-receivables-b",
  },
  {
    tokenId: 8n,
    name: "Dockside Logistics Park",
    category: "real-estate",
    totalShares: 300_000n,
    metadataURI: "hadron://assets/dockside-logistics-park",
  },
  {
    tokenId: 9n,
    name: "Silver Bullion Vault #2",
    category: "commodities",
    totalShares: 200_000n,
    metadataURI: "hadron://assets/silver-bullion-vault-2",
  },
  {
    tokenId: 10n,
    name: "Gold Standard Offset Bundle",
    category: "carbon",
    totalShares: 600_000n,
    metadataURI: "hadron://assets/gold-standard-offset-bundle",
  },
  {
    tokenId: 11n,
    name: "Solar Farm Basin-2 Notes",
    category: "infrastructure",
    totalShares: 500_000n,
    metadataURI: "hadron://assets/solar-farm-basin-2",
  },
  {
    tokenId: 12n,
    name: "Fiber Grid Metro Loop",
    category: "infrastructure",
    totalShares: 250_000n,
    metadataURI: "hadron://assets/fiber-grid-metro-loop",
  },
  {
    tokenId: 13n,
    name: "Blue-Chip Art Fraction #7",
    category: "art-collectibles",
    totalShares: 80_000n,
    metadataURI: "hadron://assets/blue-chip-art-fraction-7",
  },
  {
    tokenId: 14n,
    name: "Nexus Invoice Pool 2026-07",
    category: "invoice-financing",
    totalShares: 1_200_000n,
    metadataURI: "hadron://assets/nexus-invoice-pool-2026-07",
  },
  {
    tokenId: 15n,
    name: "German Bund 10Y",
    category: "sovereign-bonds",
    totalShares: 10_000_000n,
    metadataURI: "hadron://assets/de-bund-10y",
  },
  {
    tokenId: 16n,
    name: "JGB 5Y",
    category: "sovereign-bonds",
    totalShares: 10_000_000n,
    metadataURI: "hadron://assets/jp-jgb-5y",
  },
  {
    tokenId: 17n,
    name: "Apex Industrials 2029",
    category: "corporate-bonds",
    totalShares: 5_000_000n,
    metadataURI: "hadron://assets/apex-industrials-2029",
  },
  {
    tokenId: 18n,
    name: "Helios Utility Note 2031",
    category: "corporate-bonds",
    totalShares: 5_000_000n,
    metadataURI: "hadron://assets/helios-utility-2031",
  },
  {
    tokenId: 19n,
    name: "USDC Treasury MMF A",
    category: "money-market-funds",
    totalShares: 2_000_000n,
    metadataURI: "hadron://assets/usdc-treasury-mmf-a",
  },
  {
    tokenId: 20n,
    name: "SGD Liquidity Note 2026",
    category: "money-market-funds",
    totalShares: 1_500_000n,
    metadataURI: "hadron://assets/sgd-liquidity-note-2026",
  },
  {
    tokenId: 21n,
    name: "Prime Mortgage Pool 2026-08",
    category: "mortgages",
    totalShares: 750_000n,
    metadataURI: "hadron://assets/prime-mortgage-pool-2026-08",
  },
  {
    tokenId: 22n,
    name: "Sunbelt Rental Mortgage B",
    category: "mortgages",
    totalShares: 650_000n,
    metadataURI: "hadron://assets/sunbelt-rental-mortgage-b",
  },
  {
    tokenId: 23n,
    name: "GPU Lease 2027",
    category: "equipment-finance",
    totalShares: 400_000n,
    metadataURI: "hadron://assets/gpu-lease-2027",
  },
  {
    tokenId: 24n,
    name: "Railcar Lease Pool 2028",
    category: "equipment-finance",
    totalShares: 550_000n,
    metadataURI: "hadron://assets/railcar-lease-pool-2028",
  },
  {
    tokenId: 25n,
    name: "Indie Catalog Royalty A",
    category: "music-royalties",
    totalShares: 300_000n,
    metadataURI: "hadron://assets/indie-catalog-royalty-a",
  },
  {
    tokenId: 26n,
    name: "Streaming Royalty Basket 2026",
    category: "music-royalties",
    totalShares: 450_000n,
    metadataURI: "hadron://assets/streaming-royalty-basket-2026",
  },
];

export function staticAssetCatalog(): ChainAsset[] {
  return STATIC_ASSET_CATALOG.map((asset) => ({ ...asset }));
}

export function applyStaticAssetFallback(
  assets: ChainAsset[],
  readFailed: boolean,
): ChainAsset[] {
  if (!readFailed || assets.length > 0) {
    return assets;
  }

  return staticAssetCatalog();
}
