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

interface MockStreamChunk {
  choices: Array<{ delta: { content?: string } }>;
}

async function* mockCompletionStream(): AsyncGenerator<MockStreamChunk> {
  for (const content of MOCK_INSIGHT_CHUNKS) {
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
        async create() {
          return mockCompletionStream();
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
