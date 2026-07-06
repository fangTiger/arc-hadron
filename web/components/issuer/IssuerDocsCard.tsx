import type { IssuerDoc } from "@/lib/issuers";

export function IssuerDocsCard({ docs }: { docs: IssuerDoc[] }) {
  return (
    <section className="border border-border bg-panel/85">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          Docs
        </h2>
      </div>
      <ul className="divide-y divide-border">
        {docs.map((doc) => (
          <li className="px-4 py-4" key={doc.label}>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text">
              {doc.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">{doc.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
