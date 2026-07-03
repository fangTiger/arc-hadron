export const AI_DISCLOSURE_FOOTER =
  "AI-generated · testnet demo data · not financial advice";

export interface AiPrompt {
  system: string;
  user: string;
}

function snapshotUserMessage(kind: "asset" | "market", snapshot: unknown): string {
  return [
    `Use only this ${kind} snapshot JSON as your source data.`,
    "Snapshot JSON:",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
}

export function buildInsightPrompt(snapshot: unknown): AiPrompt {
  return {
    system: [
      "You are an analyst for the HADRON testnet exchange. Write in English.",
      "Return concise markdown with exactly these H2 sections: Outlook, Liquidity, Risk flags.",
      "Do not invent facts, prices, volumes, issuers, news, or risks outside the snapshot.",
      "If the snapshot data is insufficient or limited, say so plainly instead of guessing.",
      `End the response with exactly: ${AI_DISCLOSURE_FOOTER}`,
    ].join("\n"),
    user: snapshotUserMessage("asset", snapshot),
  };
}

export function buildBriefPrompt(snapshot: unknown): AiPrompt {
  return {
    system: [
      "You are an analyst for the HADRON testnet exchange. Write in English.",
      "Return concise markdown with exactly these H2 sections: Movers, New listings, Notable trades.",
      "Do not invent facts, prices, volumes, issuers, news, or risks outside the snapshot.",
      "If the snapshot data is insufficient or limited, say so plainly instead of guessing.",
      `End the response with exactly: ${AI_DISCLOSURE_FOOTER}`,
    ].join("\n"),
    user: snapshotUserMessage("market", snapshot),
  };
}
