import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { IssuerExternalLinksCard } from "../../../components/issuer/IssuerExternalLinksCard";
import type { IssuerExternalLink } from "../../../lib/issuers";

describe("IssuerExternalLinksCard", () => {
  test("renders safe illustrative links as external anchors", () => {
    const links: IssuerExternalLink[] = [
      { label: "Website", href: "https://demo.hadron.local/atlas" },
    ];

    const html = renderToStaticMarkup(<IssuerExternalLinksCard links={links} />);

    expect(html).toContain("External Links");
    expect(html).toContain("href=\"https://demo.hadron.local/atlas\"");
    expect(html).toContain("target=\"_blank\"");
    expect(html).toContain("rel=\"noopener noreferrer\"");
  });

  test("warns and renders an illustrative placeholder when a link does not use the demo domain", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const links: IssuerExternalLink[] = [
      { label: "Unsafe", href: "https://example.com/unsafe" },
    ];

    const html = renderToStaticMarkup(<IssuerExternalLinksCard links={links} />);

    expect(warn).toHaveBeenCalledWith(
      "Unsafe issuer external link blocked:",
      "https://example.com/unsafe",
    );
    expect(html).toContain("Unavailable illustrative link");
    expect(html).not.toContain("Unavailable demo link");
    expect(html).not.toContain("https://example.com/unsafe");

    warn.mockRestore();
  });
});
