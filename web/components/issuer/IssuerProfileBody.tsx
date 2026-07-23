"use client";

import { useMemo, useSyncExternalStore } from "react";
import { IssuerActivityListView } from "@/components/issuer/IssuerActivityList";
import { IssuerAssetsTable } from "@/components/issuer/IssuerAssetsTable";
import { IssuerDocsCard } from "@/components/issuer/IssuerDocsCard";
import { IssuerExternalLinksCard } from "@/components/issuer/IssuerExternalLinksCard";
import { IssuerKpiBar } from "@/components/issuer/IssuerKpiBar";
import { useAssets } from "@/lib/hooks/useAssets";
import { useMarketEvents } from "@/lib/hooks/useMarketEvents";
import { computeIssuerKpis, type Issuer } from "@/lib/issuers";

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
}

export function IssuerProfileBody({ issuer }: { issuer: Issuer }) {
  const hasHydrated = useHasHydrated();
  const { assets, errorZh, isLoading: isAssetsLoading } = useAssets();
  const { events, isLoading: isEventsLoading, nowMs } = useMarketEvents();
  const issuerAssets = useMemo(() => {
    const issuerAssetSlugs = new Set(issuer.assetIds);

    return assets.filter((asset) => issuerAssetSlugs.has(asset.meta.slug));
  }, [assets, issuer.assetIds]);
  const kpis = useMemo(
    () => computeIssuerKpis(issuer.slug, issuerAssets, events),
    [events, issuer.slug, issuerAssets],
  );

  return (
    <div className="min-w-0 space-y-5">
      <IssuerKpiBar
        kpis={{
          ...kpis,
          assetsCount: issuer.assetIds.length,
          cumulativeVolumeUsdc: !hasHydrated || isEventsLoading ? undefined : kpis.cumulativeVolumeUsdc,
        }}
      />

      <div
        className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]"
        data-issuer-profile-grid
      >
        <div className="min-w-0">
          <IssuerAssetsTable
            assets={issuerAssets}
            errorText={errorZh}
            events={events}
            isLoading={isAssetsLoading}
            nowMs={nowMs}
          />
        </div>
        <aside className="min-w-0 space-y-5">
          <IssuerDocsCard docs={issuer.docs} />
          <IssuerExternalLinksCard links={issuer.externalLinks} />
          <IssuerActivityListView
            assets={issuerAssets}
            events={events}
            isLoading={isEventsLoading}
            issuer={issuer}
            nowMs={nowMs}
          />
        </aside>
      </div>
    </div>
  );
}
