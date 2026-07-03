import { afterEach, describe, expect, test, vi } from "vitest";

// 逐用例控制 env，避免读取宿主机真实密钥
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadModule() {
  return import("../lib/llm/deepseek");
}

describe("DeepSeek 客户端工厂", () => {
  test("无 key 的非生产环境返回 mock 客户端，流式输出 HADRON 示例简报", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("NODE_ENV", "test");

    const { getDeepSeekClient, isMockDeepSeekClient } = await loadModule();
    const client = getDeepSeekClient();

    expect(isMockDeepSeekClient(client)).toBe(true);

    const stream = await client.chat.completions.create({
      messages: [{ role: "user", content: "insight" }],
      model: "any",
      stream: true,
    });

    let text = "";
    for await (const chunk of stream as AsyncIterable<{
      choices: Array<{ delta: { content?: string } }>;
    }>) {
      text += chunk.choices[0]?.delta.content ?? "";
    }

    expect(text).toContain("Outlook");
    expect(text).toContain("not financial advice");
  });

  test("无 key 的生产环境抛错", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");

    const { getDeepSeekClient } = await loadModule();

    expect(() => getDeepSeekClient()).toThrow("DEEPSEEK_API_KEY");
  });

  test("有 key 时返回真实 OpenAI 兼容客户端（不发请求）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://example.invalid");

    const { getDeepSeekClient, isMockDeepSeekClient, DEEPSEEK_MODEL } = await loadModule();
    const client = getDeepSeekClient();

    expect(isMockDeepSeekClient(client)).toBe(false);
    expect(typeof DEEPSEEK_MODEL).toBe("string");
    expect(DEEPSEEK_MODEL.length).toBeGreaterThan(0);
  });
});
