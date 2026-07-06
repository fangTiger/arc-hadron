import OpenAI from "openai";

/** 默认模型；可用 DEEPSEEK_MODEL 覆盖（自 arc-lepton 移植的约定）。 */
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

/** mock 流内容：HADRON 洞察示例，保证无 key 的开发/测试环境可完整演示交互。 */
const MOCK_INSIGHT_CHUNKS = [
  "## Outlook\nTrading activity on this asset is thin but consistent with a newly issued testnet catalog. ",
  "Primary offering absorption is the main price anchor.\n\n",
  "## Liquidity\nOrder book depth is limited to a few seed listings around the issue price; ",
  "expect wide effective spreads on larger clips.\n\n",
  "## Risk flags\n- Sparse trade history limits signal quality\n- Seeded self-trades inflate apparent activity\n\n",
  "---\nAI-generated · testnet illustrative data · not financial advice\n",
];

/** mock 流内容：Market Brief 变体，让无 key 演示时简报也呈现正确的三节结构。 */
const MOCK_BRIEF_CHUNKS = [
  "## Movers\nSeeded treasuries lead turnover; price drift stays within the issue band. ",
  "Thin books amplify single-trade moves.\n\n",
  "## New listings\nA handful of secondary listings sit just above the primary offering price.\n\n",
  "## Notable trades\n- Primary-sale absorption dominates volume\n- Secondary crossings remain sporadic\n\n",
  "---\nAI-generated · testnet illustrative data · not financial advice\n",
];

interface MockStreamChunk {
  choices: Array<{ delta: { content?: string } }>;
}

interface MockJsonCompletion {
  choices: Array<{ message: { content: string } }>;
}

interface MockStreamParams {
  messages: unknown;
  model: string;
  stream: true;
}

interface MockJsonParams {
  messages: unknown;
  model: string;
  response_format?: { type?: string };
  stream?: false;
}

type MockCompletionParams = MockStreamParams | MockJsonParams;
type MockCreateCompletion = MockDeepSeekClient["chat"]["completions"]["create"];

/** 依据 system 提示选择 mock 形态：包含 Movers 的按 Market Brief 输出，否则按 Asset Insight。 */
function mockChunksFor(messages: unknown): readonly string[] {
  const wantsBrief =
    Array.isArray(messages) &&
    messages.some(
      (message) =>
        typeof (message as { content?: unknown })?.content === "string" &&
        ((message as { content: string }).content.includes("Movers")),
    );

  return wantsBrief ? MOCK_BRIEF_CHUNKS : MOCK_INSIGHT_CHUNKS;
}

async function* mockCompletionStream(chunks: readonly string[]): AsyncGenerator<MockStreamChunk> {
  for (const content of chunks) {
    yield { choices: [{ delta: { content } }] };
  }
}

function messageContents(messages: unknown): string[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.flatMap((message) => {
    const content = (message as { content?: unknown })?.content;

    return typeof content === "string" ? [content] : [];
  });
}

function userPromptValue(content: string, key: "defaultAsset" | "userMessage"): string | null {
  const match = content.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  const value = match?.[1]?.trim();

  if (!value || value === "null") {
    return null;
  }

  return value;
}

function intentPromptParts(messages: unknown): { defaultAsset: string | null; userMessage: string } {
  const contents = messageContents(messages);
  const userContent = contents.at(-1) ?? "";

  return {
    defaultAsset: userPromptValue(userContent, "defaultAsset"),
    userMessage: userPromptValue(userContent, "userMessage") ?? userContent,
  };
}

function cleanAsset(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/[?.!,;:]+$/g, "");

  return cleaned ? cleaned : null;
}

function assetAfterPreposition(message: string): string | null {
  const match = message.match(/\b(?:for|on|of)\s+([a-z0-9][a-z0-9._-]*(?:\s+[a-z0-9][a-z0-9._-]*)?)/i);

  return cleanAsset(match?.[1]);
}

function trailingAsset(message: string): string | null {
  const tokens = message.match(/\b[a-z][a-z0-9._-]*\b/gi) ?? [];
  const ignored = new Set([
    "ask",
    "bid",
    "book",
    "buy",
    "cancel",
    "claim",
    "depth",
    "for",
    "holdings",
    "list",
    "lowest",
    "my",
    "order",
    "orders",
    "price",
    "show",
    "sell",
    "the",
    "what",
    "yield",
  ]);
  const token = [...tokens].reverse().find((item) => !ignored.has(item.toLowerCase()));

  return cleanAsset(token);
}

function assetFromMessage(message: string, defaultAsset: string | null = null): string | null {
  return assetAfterPreposition(message) ?? trailingAsset(message) ?? defaultAsset;
}

function sellIntentFromMessage(message: string, defaultAsset: string | null): unknown {
  const match = message.match(
    /\b(?:sell|list)\s+(\d+(?:\.\d{1,2})?)(?:\s+(?:shares?\s+(?:of\s+)?)?(.+?))?(?:\s+(?:at|for)\s+\$?(\d+(?:\.\d{1,2})?))?\s*$/i,
  );
  const quantity = match ? Number(match[1]) : Number.NaN;
  const asset = cleanAsset(match?.[2]) ?? defaultAsset;
  const price = match?.[3] === undefined ? undefined : Number(match[3]);

  if (!Number.isFinite(quantity) || quantity <= 0 || !asset) {
    return { kind: "unknown" };
  }

  return price !== undefined && Number.isFinite(price) && price > 0
    ? { kind: "sell", asset, quantity, price }
    : { kind: "sell", asset, quantity };
}

function cancelIntentFromMessage(message: string, defaultAsset: string | null): unknown {
  const match = message.match(/\bcancel(?:\s+my)?(?:\s+(.+?))?(?:\s+orders?)?\s*$/i);
  const asset = cleanAsset(match?.[1]) ?? defaultAsset;

  return asset ? { kind: "cancel", asset } : { kind: "unknown" };
}

function claimIntentFromMessage(message: string): unknown {
  const match = message.match(/\bclaim(?:\s+my)?(?:\s+(.+?))?\s+yield\b/i);
  const asset = cleanAsset(match?.[1]);

  return asset ? { kind: "claim", asset } : { kind: "claim" };
}

function mockIntentFor(messages: unknown): MockJsonCompletion {
  const { defaultAsset, userMessage } = intentPromptParts(messages);
  const lower = userMessage.toLowerCase();
  let intent: unknown = { kind: "unknown" };

  if (/\b(deposit|transfer)\b/.test(lower)) {
    intent = { kind: "unknown" };
  } else if (/\b(sell|list)\b/.test(lower)) {
    intent = sellIntentFromMessage(userMessage, defaultAsset);
  } else if (/\bcancel\b/.test(lower)) {
    intent = cancelIntentFromMessage(userMessage, defaultAsset);
  } else if (/\bclaim\b/.test(lower)) {
    intent = claimIntentFromMessage(userMessage);
  } else if (/\bbuy\b/.test(lower)) {
    const match = userMessage.match(/\bbuy\s+(\d+(?:\.\d{1,2})?)(?:\s+(?:shares?\s+(?:of\s+)?)?(.+))?$/i);
    const quantity = match ? Number(match[1]) : Number.NaN;
    const asset = cleanAsset(match?.[2]) ?? defaultAsset;

    intent = Number.isFinite(quantity) && quantity > 0 && asset
      ? { kind: "buy", asset, quantity }
      : { kind: "unknown" };
  } else if (/\b(depth|order\s+book|book)\b/.test(lower)) {
    const asset = assetFromMessage(userMessage, defaultAsset);
    intent = asset ? { kind: "query_depth", asset } : { kind: "unknown" };
  } else if (/\b(holding|holdings|position|positions|balance)\b/.test(lower)) {
    const asset = assetAfterPreposition(userMessage);
    intent = asset ? { kind: "query_holdings", asset } : { kind: "query_holdings" };
  } else if (/\b(yield|unclaimed|reward|rewards)\b/.test(lower)) {
    intent = { kind: "query_yield" };
  } else if (/\b(price|ask|bid|lowest|highest)\b/.test(lower)) {
    const asset = assetFromMessage(userMessage, defaultAsset);
    intent = asset ? { kind: "query_price", asset } : { kind: "unknown" };
  }

  return {
    choices: [{ message: { content: JSON.stringify(intent) } }],
  };
}

function wantsIntentJson(params: MockCompletionParams): boolean {
  return (
    params.stream !== true &&
    params.response_format?.type === "json_object" &&
    messageContents(params.messages).some((content) => content.includes("Allowed JSON shapes only"))
  );
}

/** 与 OpenAI SDK 对齐的最小接口面：本项目只用流式 chat.completions。 */
export interface MockDeepSeekClient {
  readonly isMock: true;
  chat: {
    completions: {
      create: {
        (
          params: MockStreamParams,
          options?: { signal?: AbortSignal },
        ): Promise<AsyncGenerator<MockStreamChunk>>;
        (params: MockJsonParams, options?: { signal?: AbortSignal }): Promise<MockJsonCompletion>;
      };
    };
  };
}

function createMockDeepSeekClient(): MockDeepSeekClient {
  const create = (async (params: MockCompletionParams) => {
    if (wantsIntentJson(params)) {
      return mockIntentFor(params.messages);
    }

    return mockCompletionStream(mockChunksFor(params.messages));
  }) as MockCreateCompletion;

  return {
    isMock: true,
    chat: {
      completions: {
        create,
      },
    },
  };
}

export type DeepSeekClient = OpenAI | MockDeepSeekClient;

export function isMockDeepSeekClient(client: DeepSeekClient): client is MockDeepSeekClient {
  return "isMock" in client && client.isMock === true;
}

/**
 * 客户端工厂：有 key 返回真实 OpenAI 兼容客户端；
 * 无 key 时开发/测试环境返回 mock（零网络调用），生产环境抛错（路由层转 503）。
 */
export function getDeepSeekClient(): DeepSeekClient {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DEEPSEEK_API_KEY required in production");
    }

    return createMockDeepSeekClient();
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
}
