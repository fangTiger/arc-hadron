import { buildIntentPrompt } from "@/lib/ai/intentPrompt";
import { parseIntent } from "@/lib/ai/intent";
import { guardAiJsonRequest, jsonError } from "@/lib/ai/routeShared";
import { DEEPSEEK_MODEL, getDeepSeekClient } from "@/lib/llm/deepseek";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IntentRequestPayload {
  message: string;
  defaultAsset?: string | null;
}

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekIntentCompletion = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type DeepSeekIntentClient = {
  chat: {
    completions: {
      create: (
        params: {
          model: string;
          messages: ChatMessage[];
          response_format: { type: "json_object" };
          stream: false;
        },
        options: { signal: AbortSignal },
      ) => Promise<DeepSeekIntentCompletion>;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isBoundedNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalAssetContext(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isBoundedNonEmptyString(value, 256);
}

function isIntentRequestShape(value: unknown): value is IntentRequestPayload {
  if (!isRecord(value)) {
    return false;
  }

  const hasDefaultAsset = "defaultAsset" in value;

  return (
    hasOnlyKeys(value, hasDefaultAsset ? ["defaultAsset", "message"] : ["message"]) &&
    isBoundedNonEmptyString(value.message, 2048) &&
    isOptionalAssetContext(value.defaultAsset)
  );
}

function createMessages(prompt: { system: string; user: string }): ChatMessage[] {
  return [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function completionContent(completion: DeepSeekIntentCompletion): string | null {
  return completion.choices?.[0]?.message?.content ?? null;
}

function isNoKeyError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("DEEPSEEK_API_KEY");
}

export async function POST(request: Request): Promise<Response> {
  const guardedRequest = await guardAiJsonRequest(request, {
    invalidPayloadMessage: "Invalid intent request",
    validatePayload: isIntentRequestShape,
  });

  if (!guardedRequest.ok) {
    return guardedRequest.response;
  }

  let client: DeepSeekIntentClient;

  try {
    client = getDeepSeekClient() as DeepSeekIntentClient;
  } catch (error) {
    if (isNoKeyError(error)) {
      return jsonError("AI is not configured", 503);
    }

    return jsonError("AI is not configured", 503);
  }

  const prompt = buildIntentPrompt(guardedRequest.payload);

  try {
    const completion = await client.chat.completions.create(
      {
        model: DEEPSEEK_MODEL,
        messages: createMessages(prompt),
        response_format: { type: "json_object" },
        stream: false,
      },
      { signal: request.signal },
    );
    const content = completionContent(completion);
    const parsed = content ? parseJson(content) : null;

    return Response.json(parseIntent(parsed));
  } catch {
    return jsonError("Intent parsing failed", 502);
  }
}
