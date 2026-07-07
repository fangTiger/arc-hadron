import { isAddress, type Address } from "viem";
import type { TradeEventType } from "@/lib/events";

const READ_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=15",
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export class QueryParamError extends Error {}

export function jsonOk(payload: unknown): Response {
  return Response.json(payload, { headers: READ_HEADERS });
}

export function jsonNoStoreOk(payload: unknown): Response {
  return Response.json(payload, { headers: NO_STORE_HEADERS });
}

export function jsonInvalidApiKey(): Response {
  return Response.json(
    {
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or invalid team-issued HADRON API key.",
      },
    },
    { headers: NO_STORE_HEADERS, status: 401 },
  );
}

export function jsonInvalidOrder(message: string): Response {
  return Response.json(
    {
      error: {
        code: "INVALID_ORDER",
        message,
      },
    },
    { headers: NO_STORE_HEADERS, status: 400 },
  );
}

export function jsonQueryError(message: string): Response {
  return Response.json(
    {
      error: {
        code: "INVALID_QUERY",
        message,
      },
    },
    { status: 400 },
  );
}

export function jsonUpstreamError(): Response {
  return Response.json(
    {
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Failed to load HADRON query data from Arc RPC.",
      },
    },
    { status: 502 },
  );
}

export function jsonTradingUpstreamError(): Response {
  return Response.json(
    {
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Failed to submit or inspect HADRON trading data from Arc RPC.",
      },
    },
    { headers: NO_STORE_HEADERS, status: 502 },
  );
}

export function parseOptionalBigIntParam(params: URLSearchParams, name: string): bigint | undefined {
  const value = params.get(name);

  if (value === null || value.trim() === "") {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new QueryParamError(`${name} must be a positive integer string.`);
  }

  return BigInt(value);
}

export function parseOptionalAddressParam(params: URLSearchParams, name: string): Address | undefined {
  const value = params.get(name);

  if (value === null || value.trim() === "") {
    return undefined;
  }

  if (!isAddress(value)) {
    throw new QueryParamError(`${name} must be a valid 0x address.`);
  }

  return value;
}

export function parseLimitParam(params: URLSearchParams): number | undefined {
  const value = params.get("limit");

  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    throw new QueryParamError("limit must be an integer between 1 and 200.");
  }

  return parsed;
}

export function parseTradeEventType(params: URLSearchParams): TradeEventType | undefined {
  const value = params.get("type");

  if (value === null || value.trim() === "") {
    return undefined;
  }

  const allowed = new Set<TradeEventType>([
    "asset-issued",
    "bid-cancelled",
    "bid-filled",
    "bid-placed",
    "cancelled",
    "listed",
    "offering-closed",
    "offering-created",
    "primary-sale",
    "purchased",
    "yield-claimed",
    "yield-deposited",
  ]);

  if (!allowed.has(value as TradeEventType)) {
    throw new QueryParamError("type must be a supported HADRON event type.");
  }

  return value as TradeEventType;
}
