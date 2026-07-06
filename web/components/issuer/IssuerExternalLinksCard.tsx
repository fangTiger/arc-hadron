import type { IssuerExternalLink } from "@/lib/issuers";

const DEMO_LINK_PREFIX = "https://demo.hadron.local/";

function safeLink(link: IssuerExternalLink): IssuerExternalLink | null {
  if (link.href.startsWith(DEMO_LINK_PREFIX)) {
    return link;
  }

  console.warn("Unsafe issuer external link blocked:", link.href);
  return null;
}

export function IssuerExternalLinksCard({ links }: { links: IssuerExternalLink[] }) {
  const rows = links.map((link) => ({
    label: link.label,
    safe: safeLink(link),
  }));

  return (
    <section className="border border-border bg-panel/85">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          External Links
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li className="px-4 py-3" key={row.label}>
            {row.safe ? (
              <a
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                href={row.safe.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {row.safe.label}
                <span aria-hidden="true">-&gt;</span>
              </a>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                {row.label}: Unavailable illustrative link
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
