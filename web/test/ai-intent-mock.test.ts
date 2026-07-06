import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function parseWithMock(message: string, defaultAsset?: string | null): Promise<unknown> {
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  vi.stubEnv("NODE_ENV", "test");

  const [{ buildIntentPrompt }, { getDeepSeekClient }] = await Promise.all([
    import("../lib/ai/intentPrompt"),
    import("../lib/llm/deepseek"),
  ]);
  const prompt = buildIntentPrompt({ defaultAsset, message });
  const client = getDeepSeekClient();
  const completion = await client.chat.completions.create({
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    model: "any",
    response_format: { type: "json_object" },
    stream: false,
  });

  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

describe("DeepSeek intent mock", () => {
  test("returns canned price, depth, holdings, yield, buy, and unknown intents", async () => {
    await expect(parseWithMock("what is the lowest ask for HADRON")).resolves.toEqual({
      kind: "query_price",
      asset: "HADRON",
    });
    await expect(parseWithMock("show depth for TBILL")).resolves.toEqual({
      kind: "query_depth",
      asset: "TBILL",
    });
    await expect(parseWithMock("my holdings")).resolves.toEqual({
      kind: "query_holdings",
    });
    await expect(parseWithMock("unclaimed yield")).resolves.toEqual({
      kind: "query_yield",
    });
    await expect(parseWithMock("buy 2.5 HADRON")).resolves.toEqual({
      kind: "buy",
      asset: "HADRON",
      quantity: 2.5,
    });
    await expect(parseWithMock("transfer 1 HADRON")).resolves.toEqual({
      kind: "unknown",
    });
  });

  test("uses default asset for buy commands that omit an asset", async () => {
    await expect(parseWithMock("buy 5", "HADRON")).resolves.toEqual({
      kind: "buy",
      asset: "HADRON",
      quantity: 5,
    });
  });

  test("returns write intents for sell, cancel, and claim without transaction parameters", async () => {
    await expect(parseWithMock("sell 2.5 HADRON at 2.10")).resolves.toEqual({
      kind: "sell",
      asset: "HADRON",
      quantity: 2.5,
      price: 2.1,
    });
    await expect(parseWithMock("list 1.25 TBILL")).resolves.toEqual({
      kind: "sell",
      asset: "TBILL",
      quantity: 1.25,
    });
    await expect(parseWithMock("cancel my HADRON order")).resolves.toEqual({
      kind: "cancel",
      asset: "HADRON",
    });
    await expect(parseWithMock("claim my HADRON yield")).resolves.toEqual({
      kind: "claim",
      asset: "HADRON",
    });
    await expect(parseWithMock("claim my yield")).resolves.toEqual({
      kind: "claim",
    });
    await expect(parseWithMock("deposit 10 USDC yield to HADRON")).resolves.toEqual({
      kind: "unknown",
    });
  });
});
