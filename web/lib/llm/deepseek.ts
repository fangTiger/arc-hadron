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
  "---\nAI-generated · testnet demo data · not financial advice\n",
];

/** mock 流内容：Market Brief 变体，让无 key 演示时简报也呈现正确的三节结构。 */
const MOCK_BRIEF_CHUNKS = [
  "## Movers\nSeeded treasuries lead turnover; price drift stays within the issue band. ",
  "Thin books amplify single-trade moves.\n\n",
  "## New listings\nA handful of secondary listings sit just above the primary offering price.\n\n",
  "## Notable trades\n- Primary-sale absorption dominates volume\n- Secondary crossings remain sporadic\n\n",
  "---\nAI-generated · testnet demo data · not financial advice\n",
];

interface MockStreamChunk {
  choices: Array<{ delta: { content?: string } }>;
}

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

/** 与 OpenAI SDK 对齐的最小接口面：本项目只用流式 chat.completions。 */
export interface MockDeepSeekClient {
  readonly isMock: true;
  chat: {
    completions: {
      create: (
        params: { messages: unknown; model: string; stream?: boolean },
        options?: { signal?: AbortSignal },
      ) => Promise<AsyncGenerator<MockStreamChunk>>;
    };
  };
}

function createMockDeepSeekClient(): MockDeepSeekClient {
  return {
    isMock: true,
    chat: {
      completions: {
        async create(params: { messages: unknown }) {
          return mockCompletionStream(mockChunksFor(params.messages));
        },
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
