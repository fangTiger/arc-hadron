import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { IssuerKpiBar } from "../../../components/issuer/IssuerKpiBar";

const USDC = 10n ** 18n;

describe("IssuerKpiBar", () => {
  test("renders all four issuer KPI cells with formatted values", () => {
    const html = renderToStaticMarkup(
      <IssuerKpiBar
        kpis={{
          assetsCount: 3,
          cumulativeVolumeUsdc: 142_300n * USDC,
          totalShares: 12_345_678_90n,
          weightedApyBps: 842,
        }}
      />,
    );

    expect(html).toContain("Assets");
    expect(html).toContain("3");
    expect(html).toContain("Total Shares Issued");
    expect(html).toContain("12,345,678.90");
    expect(html).toContain("Cumulative Volume");
    expect(html).toContain("142.3K");
    expect(html).toContain("Weighted APY");
    expect(html).toContain("8.42%");
  });

  test("renders only the cumulative volume cell as skeleton when volume is loading", () => {
    const html = renderToStaticMarkup(
      <IssuerKpiBar
        kpis={{
          assetsCount: 1,
          cumulativeVolumeUsdc: undefined,
          totalShares: 1_000_000n,
          weightedApyBps: 510,
        }}
      />,
    );

    expect(html).toContain("Assets");
    expect(html).toContain("Total Shares Issued");
    expect(html).toContain("Weighted APY");
    expect(html).toContain("Cumulative Volume");
    expect(html).toContain("data-testid=\"issuer-volume-skeleton\"");
    expect(html).toContain("hadron-skeleton");
  });
});
