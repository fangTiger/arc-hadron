"use client";

export interface ExploreIssuerOption {
  assetsCount: number;
  displayName: string;
  slug: string;
}

export function ExploreIssuerFilter({
  issuers,
  onChange,
  selectedSlug,
}: {
  issuers: ExploreIssuerOption[];
  onChange: (slug: string | null) => void;
  selectedSlug: string | null;
}) {
  return (
    <select
      aria-label="Issuer"
      className="h-10 w-full border border-border bg-panel/80 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text outline-none transition-colors duration-200 focus:border-neon sm:max-w-sm"
      onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      value={selectedSlug ?? ""}
    >
      <option value="">All Issuers</option>
      {issuers.map((issuer) => (
        <option key={issuer.slug} value={issuer.slug}>
          {issuer.displayName} ({issuer.assetsCount})
        </option>
      ))}
    </select>
  );
}
