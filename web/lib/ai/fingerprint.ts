type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };

function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry ?? null)).join(",")}]`;
  }

  const entries = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] as JsonValue)}`);

  return `{${entries.join(",")}}`;
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

// 快照由 lib/ai/snapshot.ts 构造，保证 JSON 可序列化；入口收 unknown，内部按 JsonValue 处理。
export function fingerprintSnapshot(snapshot: unknown): string {
  return fnv1a32(stableStringify(snapshot as JsonValue));
}

export function stableSnapshotJson(snapshot: unknown): string {
  return stableStringify(snapshot as JsonValue);
}
