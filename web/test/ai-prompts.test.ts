import { describe, expect, test } from "vitest";
import { buildBriefPrompt, buildInsightPrompt } from "../lib/ai/prompts";

const FOOTER = "AI-generated · testnet demo data · not financial advice";

const assetSnapshot = {
  schemaVersion: "hadron-ai-snapshot-v1",
  kind: "asset",
  asset: {
    tokenId: "15",
    ticker: "TBILL",
    latestSharePrice: "1.25",
    change24hPct: 0,
  },
  recentTrades: [],
  orderBook: [],
};

const marketSnapshot = {
  schemaVersion: "hadron-ai-snapshot-v1",
  kind: "market",
  summary: {
    assetCount: 0,
    total24hVolume: "0.00",
  },
  assets: [],
  recentTrades: [],
};

function expectSharedSystemRules(system: string) {
  expect(system).toContain("English");
  expect(system).toContain(FOOTER);
  expect(system).toMatch(/do not (invent|fabricate)/i);
  expect(system).toMatch(/outside (the )?snapshot/i);
  expect(system).toMatch(/insufficient|limited|not enough/i);
}

describe("AI prompt builders", () => {
  test("builds an asset insight prompt with the required markdown sections and guardrails", () => {
    const prompt = buildInsightPrompt(assetSnapshot);

    expect(prompt).toEqual({
      system: expect.any(String),
      user: expect.any(String),
    });
    expectSharedSystemRules(prompt.system);
    expect(prompt.system).toContain("Outlook");
    expect(prompt.system).toContain("Liquidity");
    expect(prompt.system).toContain("Risk flags");
    expect(prompt.user).toContain("TBILL");
    expect(prompt.user).toContain('"kind": "asset"');
  });

  test("builds a market brief prompt with the required markdown sections and guardrails", () => {
    const prompt = buildBriefPrompt(marketSnapshot);

    expect(prompt).toEqual({
      system: expect.any(String),
      user: expect.any(String),
    });
    expectSharedSystemRules(prompt.system);
    expect(prompt.system).toContain("Movers");
    expect(prompt.system).toContain("New listings");
    expect(prompt.system).toContain("Notable trades");
    expect(prompt.user).toContain('"kind": "market"');
    expect(prompt.user).toContain('"assetCount": 0');
  });
});
