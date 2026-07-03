export type AiSseEventType = "chunk" | "done" | "error";

export interface AiSseEvent<T = unknown> {
  type: AiSseEventType;
  data: T;
}

export interface SseFrameParser {
  push(chunk: string): AiSseEvent[];
}

function isAiSseEventType(value: string): value is AiSseEventType {
  return value === "chunk" || value === "done" || value === "error";
}

function findFrameBoundary(buffer: string): { index: number; length: number } | null {
  const lfIndex = buffer.indexOf("\n\n");
  const crlfIndex = buffer.indexOf("\r\n\r\n");

  if (lfIndex === -1 && crlfIndex === -1) {
    return null;
  }

  if (lfIndex === -1) {
    return { index: crlfIndex, length: 4 };
  }

  if (crlfIndex === -1 || lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 };
  }

  return { index: crlfIndex, length: 4 };
}

function parseFrame(frame: string): AiSseEvent | null {
  const lines = frame.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let eventType: AiSseEventType | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      const value = line.slice("event:".length).trim();

      if (isAiSseEventType(value)) {
        eventType = value;
      }
    }

    if (line.startsWith("data:")) {
      const value = line.slice("data:".length);
      dataLines.push(value.startsWith(" ") ? value.slice(1) : value);
    }
  }

  if (!eventType) {
    return null;
  }

  return {
    type: eventType,
    data: JSON.parse(dataLines.join("\n")),
  };
}

export function encodeSseEvent(type: AiSseEventType, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createSseFrameParser(): SseFrameParser {
  let buffer = "";

  return {
    push(chunk: string): AiSseEvent[] {
      buffer += chunk;

      const events: AiSseEvent[] = [];
      let boundary = findFrameBoundary(buffer);

      while (boundary) {
        const frame = buffer.slice(0, boundary.index);
        const event = parseFrame(frame);

        if (event) {
          events.push(event);
        }

        buffer = buffer.slice(boundary.index + boundary.length);
        boundary = findFrameBoundary(buffer);
      }

      return events;
    },
  };
}
