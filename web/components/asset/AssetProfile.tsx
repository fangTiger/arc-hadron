"use client";

import { useState } from "react";
import { categoryDisplay } from "@/lib/categories";
import { HADRON_ASSETS_ADDRESS } from "@/lib/contracts";
import { formatShares, shortAddress } from "@/lib/format";
import type { AssetView } from "@/lib/mappers";

function addressExplorerUrl(address: string): string {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  return `${explorerUrl.trim().replace(/\/+$/, "")}/address/${address}`;
}

export function AssetProfile({ asset }: { asset: AssetView }) {
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const category = categoryDisplay(asset.category);

  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(HADRON_ASSETS_ADDRESS);
      setCopyNotice("Copied");
    } catch {
      setCopyNotice("Copy failed");
    }
  }

  return (
    <article className="overflow-hidden border border-border bg-panel">
      <div className="relative min-h-56 border-b border-border" style={{ background: category.gradient }}>
        <div className="absolute inset-0 bg-linear-to-t from-bg/70 via-bg/10 to-transparent" />
        <div className="relative flex min-h-56 flex-col justify-end p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim">{category.label}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-text sm:text-5xl">
            {asset.meta.displayName}
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neon-dim">
            {asset.meta.ticker} / TOKEN #{asset.tokenId.toString()}
          </p>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">ASSET DESCRIPTION</p>
          <p className="mt-4 text-base leading-8 text-text-dim">{asset.meta.description}</p>

          <div className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">ISSUER</p>
            <p className="mt-3 text-lg text-text">{asset.meta.issuer}</p>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">DOCUMENTS</p>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {asset.meta.docs.map((doc) => (
                <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]" key={doc.label}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">{doc.label}</p>
                  <p className="text-sm leading-6 text-muted">{doc.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit border border-border bg-bg/35 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">ON-CHAIN PROFILE</p>
          <dl className="mt-5 divide-y divide-border border-y border-border">
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">TOTAL SHARES</dt>
              <dd className="font-mono text-sm text-text">{formatShares(asset.totalShares)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">TOKEN ID</dt>
              <dd className="font-mono text-sm text-text">{asset.tokenId.toString()}</dd>
            </div>
            <div className="py-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">CONTRACT ADDRESS</dt>
              <dd className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  className="font-mono text-sm text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                  href={addressExplorerUrl(HADRON_ASSETS_ADDRESS)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {shortAddress(HADRON_ASSETS_ADDRESS)}
                </a>
                <button
                  className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text"
                  onClick={copyContractAddress}
                  type="button"
                >
                  Copy
                </button>
                {copyNotice ? <span className="text-xs text-muted">{copyNotice}</span> : null}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </article>
  );
}
