import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AiMarkdown } from "../components/ai/AiMarkdown";

describe("AiMarkdown", () => {
  test("renders the allowed heading, list, strong, and paragraph markdown subset", () => {
    const html = renderToStaticMarkup(
      <AiMarkdown
        markdown={[
          "## Outlook",
          "Liquidity is **thin** but orderly.",
          "",
          "### Risk flags",
          "- No secondary fills in the latest window",
          "- Best ask is above the last traded price",
        ].join("\n")}
      />,
    );

    expect(html).toContain("<h2");
    expect(html).toContain(">Outlook</h2>");
    expect(html).toContain("<h3");
    expect(html).toContain(">Risk flags</h3>");
    expect(html).toContain("<strong>thin</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("No secondary fills");
  });

  test("renders script tags, inline HTML, and markdown links as escaped plain text", () => {
    const html = renderToStaticMarkup(
      <AiMarkdown
        markdown={[
          "## <script>alert('x')</script>",
          "Inline <img src=x onerror=alert(1)> should not become HTML.",
          "- [click me](javascript:alert(1))",
        ].join("\n")}
      />,
    );

    expect(html).toContain("&lt;script&gt;alert(&#x27;x&#x27;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("[click me](javascript:alert(1))");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });
});
