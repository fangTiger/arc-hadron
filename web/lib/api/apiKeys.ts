import { timingSafeEqual } from "node:crypto";
import { jsonInvalidApiKey } from "@/lib/api/publicRoutes";

const KEY_SEPARATORS = /[\s,]+/;

export function issuedApiKeys(value = process.env.HADRON_API_KEYS): string[] {
  return (value ?? "")
    .split(KEY_SEPARATORS)
    .map((key) => key.trim())
    .filter(Boolean);
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const parts = header.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function authenticateApiKey(request: Request, activeKeys = issuedApiKeys()): boolean {
  const token = bearerToken(request);

  if (!token || activeKeys.length === 0) {
    return false;
  }

  return activeKeys.some((key) => timingSafeStringEqual(token, key));
}

export function requireApiKey(request: Request): Response | null {
  return authenticateApiKey(request) ? null : jsonInvalidApiKey();
}
