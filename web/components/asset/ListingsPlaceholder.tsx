interface ListingsPlaceholderProps {
  title?: string;
  message?: string;
}

export function ListingsPlaceholder({
  title = "SECONDARY LISTINGS",
  message = "Secondary listings open in M3",
}: ListingsPlaceholderProps) {
  return (
    <section className="border border-border bg-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">{title}</h2>
        <span className="border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          PLACEHOLDER
        </span>
      </div>
      <div className="mt-6 border border-dashed border-border-glow bg-bg/35 p-6">
        <p className="text-sm leading-6 text-muted">{message}</p>
      </div>
    </section>
  );
}
