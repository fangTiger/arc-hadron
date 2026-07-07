import { afterEach, describe, expect, test } from "vitest";
import { authenticateApiKey, issuedApiKeys, requireApiKey } from "../lib/api/apiKeys";

const ORIGINAL_KEYS = process.env.HADRON_API_KEYS;

function requestWithAuth(value?: string): Request {
  return new Request("https://hadron.test/v1/orders/listings/prepare", {
    headers: value ? { Authorization: value } : undefined,
  });
}

describe("team-issued API key authentication", () => {
  afterEach(() => {
    if (ORIGINAL_KEYS === undefined) {
      delete process.env.HADRON_API_KEYS;
    } else {
      process.env.HADRON_API_KEYS = ORIGINAL_KEYS;
    }
  });

  test("parses active keys from the server environment without an application flow", () => {
    process.env.HADRON_API_KEYS = "alpha, beta\nhadron_live_gamma";

    expect(issuedApiKeys()).toEqual(["alpha", "beta", "hadron_live_gamma"]);
  });

  test("accepts a valid Bearer key", () => {
    process.env.HADRON_API_KEYS = "alpha,beta";

    expect(authenticateApiKey(requestWithAuth("Bearer alpha"))).toBe(true);
    expect(requireApiKey(requestWithAuth("Bearer beta"))).toBeNull();
  });

  test("rejects missing, malformed, or unknown keys with the same 401 response", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";

    for (const auth of [undefined, "Basic alpha", "Bearer wrong"]) {
      const response = requireApiKey(requestWithAuth(auth));

      expect(response?.status).toBe(401);
      expect(await response?.json()).toEqual({
        error: {
          code: "INVALID_API_KEY",
          message: "Missing or invalid team-issued HADRON API key.",
        },
      });
    }
  });
});
