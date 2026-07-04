import type { AiPrompt } from "@/lib/ai/prompts";

export interface IntentPromptInput {
  message: string;
  defaultAsset?: string | null;
}

const INTENT_SYSTEM_LINES = [
  "You parse natural-language trading commands for the HADRON testnet exchange.",
  "Return one strict JSON object and no markdown, no prose, no code fences.",
  "Allowed JSON shapes only:",
  '{"kind":"query_price","asset":"<raw asset symbol or name>"}',
  '{"kind":"query_depth","asset":"<raw asset symbol or name>"}',
  '{"kind":"query_holdings"} or {"kind":"query_holdings","asset":"<raw asset symbol or name>"}',
  '{"kind":"query_yield"}',
  '{"kind":"buy","asset":"<raw asset symbol or name>","quantity":1.25}',
  '{"kind":"unknown"}',
  "Never output tokenId, listingId, offeringId, addresses, prices, fees, balances, msg.value, calldata, or transaction parameters.",
  "The only numeric field you may output is buy.quantity, expressed as display shares with at most two decimal places.",
  "If the user asks for selling, listing, cancelling, claiming, depositing, transfers, or anything outside prices, depth, holdings, yield, and buying, return unknown.",
  "If the user omits the asset and a defaultAsset is provided, use that exact defaultAsset string. If no defaultAsset is provided, return unknown.",
  "Examples:",
  'User: "what is the lowest ask for HADRON" => {"kind":"query_price","asset":"HADRON"}',
  'User: "show depth on tbill" => {"kind":"query_depth","asset":"tbill"}',
  'User: "my holdings" => {"kind":"query_holdings"}',
  'User: "unclaimed yield" => {"kind":"query_yield"}',
  'User: "buy 2.5 HADRON" => {"kind":"buy","asset":"HADRON","quantity":2.5}',
  'User: "sell 1 HADRON" => {"kind":"unknown"}',
];

export function buildIntentPrompt({ defaultAsset, message }: IntentPromptInput): AiPrompt {
  return {
    system: INTENT_SYSTEM_LINES.join("\n"),
    user: [
      "Parse this request into one allowed JSON intent.",
      `defaultAsset: ${defaultAsset?.trim() || "null"}`,
      `userMessage: ${message}`,
    ].join("\n"),
  };
}
