import { describe, expect, test } from "vitest";
import {
  optionalPublicEnv,
  parsePublicIntEnv,
  readAddressEnv,
  requirePublicEnv,
} from "../lib/env";

describe("public environment validation", () => {
  test("throws an English message when a required variable is missing", () => {
    expect(() => requirePublicEnv("NEXT_PUBLIC_ARC_RPC_URL", undefined)).toThrow(
      "Missing required environment variable NEXT_PUBLIC_ARC_RPC_URL. Check web/.env.local or the deployment environment.",
    );
  });

  test("returns undefined for blank optional variables", () => {
    expect(optionalPublicEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "   ")).toBeUndefined();
  });

  test("requires a positive integer chain id", () => {
    expect(parsePublicIntEnv("NEXT_PUBLIC_ARC_CHAIN_ID", "5042002")).toBe(5042002);
    expect(() => parsePublicIntEnv("NEXT_PUBLIC_ARC_CHAIN_ID", "5.5")).toThrow(
      "Environment variable NEXT_PUBLIC_ARC_CHAIN_ID must be a positive integer.",
    );
  });

  test("requires 0x-formatted contract addresses", () => {
    expect(
      readAddressEnv("NEXT_PUBLIC_HADRON_ASSETS", "0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85"),
    ).toBe("0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85");

    expect(() => readAddressEnv("NEXT_PUBLIC_HADRON_ASSETS", "not-an-address")).toThrow(
      "Environment variable NEXT_PUBLIC_HADRON_ASSETS must be a 0x-prefixed EVM address.",
    );
  });
});
