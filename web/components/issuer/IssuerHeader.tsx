import Link from "next/link";
import type { Issuer } from "@/lib/issuers";
import { BackButton } from "./BackButton";

export function IssuerHeader({ issuer }: { issuer: Issuer }) {
  return (
    <header className="overflow-hidden border border-border bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
        >
          <Link className="transition-colors duration-200 hover:text-neon" href="/">
            Market
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="transition-colors duration-200 hover:text-neon" href="/">
            Issuers
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-text">{issuer.shortName}</span>
        </nav>
        <BackButton />
      </div>

      <div className="bg-bg/35 px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="border border-neon/50 bg-neon/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-neon">
                {issuer.shortName}
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {issuer.jurisdiction} / Est. {issuer.establishedYear}
              </p>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight text-text sm:text-5xl">
              {issuer.displayName}
            </h1>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
              Focus: {issuer.focus}
            </p>
            <p
              className="mt-4 text-sm leading-6 text-text-dim sm:truncate"
              title={issuer.description}
            >
              {issuer.description}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
