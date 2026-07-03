import { describe, expect, test } from "vitest";
import { createSseFrameParser, encodeSseEvent } from "../lib/ai/sse";

describe("AI SSE helpers", () => {
  test("encodes typed events as SSE frames with JSON data", () => {
    expect(encodeSseEvent("chunk", { delta: "hello" })).toBe(
      'event: chunk\ndata: {"delta":"hello"}\n\n',
    );
    expect(encodeSseEvent("done", { ok: true })).toBe(
      'event: done\ndata: {"ok":true}\n\n',
    );
    expect(encodeSseEvent("error", { message: "failed" })).toBe(
      'event: error\ndata: {"message":"failed"}\n\n',
    );
  });

  test("parses split frames incrementally and returns all complete events", () => {
    const parser = createSseFrameParser();

    expect(parser.push("event: chu")).toEqual([]);
    expect(parser.push('nk\ndata: {"delta":"hel"}\n\n')).toEqual([
      { type: "chunk", data: { delta: "hel" } },
    ]);
    expect(
      parser.push(
        `${encodeSseEvent("chunk", { delta: "lo" })}${encodeSseEvent("done", { ok: true })}`,
      ),
    ).toEqual([
      { type: "chunk", data: { delta: "lo" } },
      { type: "done", data: { ok: true } },
    ]);
  });

  test("parses CRLF frames with multiple data lines", () => {
    const parser = createSseFrameParser();
    const frame = [
      "event: error",
      "data: {",
      'data: "message": "rate limited"',
      "data: }",
      "",
      "",
    ].join("\r\n");

    expect(parser.push(frame)).toEqual([
      { type: "error", data: { message: "rate limited" } },
    ]);
  });
});
