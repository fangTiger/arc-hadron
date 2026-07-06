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
  '{"kind":"sell","asset":"<raw asset symbol or name>","quantity":1.25} or {"kind":"sell","asset":"<raw asset symbol or name>","quantity":1.25,"price":2.1}',
  '{"kind":"cancel","asset":"<raw asset symbol or name>"}',
  '{"kind":"claim"} or {"kind":"claim","asset":"<raw asset symbol or name>"}',
  '{"kind":"unknown"}',
  "Never output tokenId, listingId, bidId, offeringId, addresses, fees, balances, msg.value, calldata, or transaction parameters.",
  "The only numeric fields you may output are buy.quantity, sell.quantity, and sell.price, expressed as display values with at most two decimal places.",
  "For sell.price, only copy a price the user explicitly provided. If price is missing, omit price; never guess.",
  "If the user asks for depositing, transfers, or anything outside prices, depth, holdings, yield, buying, selling, cancelling, and claiming, return unknown.",
  "If the user omits the asset and a defaultAsset is provided, use that exact defaultAsset string. If no defaultAsset is provided, return unknown.",
  "Examples:",
  'User: "what is the lowest ask for HADRON" => {"kind":"query_price","asset":"HADRON"}',
  'User: "show depth on tbill" => {"kind":"query_depth","asset":"tbill"}',
  'User: "my holdings" => {"kind":"query_holdings"}',
  'User: "unclaimed yield" => {"kind":"query_yield"}',
  'User: "buy 2.5 HADRON" => {"kind":"buy","asset":"HADRON","quantity":2.5}',
  'User: "sell 1 HADRON at 2.10" => {"kind":"sell","asset":"HADRON","quantity":1,"price":2.1}',
  'User: "sell 1 HADRON" => {"kind":"sell","asset":"HADRON","quantity":1}',
  'User: "cancel my HADRON order" => {"kind":"cancel","asset":"HADRON"}',
  'User: "claim my yield" => {"kind":"claim"}',
  'User: "claim HADRON yield" => {"kind":"claim","asset":"HADRON"}',
  'User: "deposit 10 USDC yield to HADRON" => {"kind":"unknown"}',
  'User: "transfer 1 HADRON" => {"kind":"unknown"}',
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
