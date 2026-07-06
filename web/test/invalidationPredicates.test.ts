import type { Query } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import {
  matchesAll,
  matchesAny,
  matchesContract,
  matchesFunctionName,
} from "../lib/hooks/invalidationPredicates";

const MARKET_ADDRESS = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD" as `0x${string}`;
const ASSETS_ADDRESS = "0x1111111111111111111111111111111111111111" as `0x${string}`;

function fakeQuery(queryKey: unknown[]): Query {
  return { queryKey } as unknown as Query;
}

describe("invalidation predicates", () => {
  test("matches a readContract functionName", () => {
    const predicate = matchesFunctionName(["listingCount"]);
    const query = fakeQuery(["readContract", { functionName: "listingCount" }]);

    expect(predicate(query)).toBe(true);
  });

  test("does not match a different readContract functionName", () => {
    const predicate = matchesFunctionName(["listingCount"]);
    const query = fakeQuery(["readContract", { functionName: "bidCount" }]);

    expect(predicate(query)).toBe(false);
  });

  test("matches any readContracts contract functionName", () => {
    const predicate = matchesFunctionName(["getListing"]);
    const query = fakeQuery([
      "readContracts",
      { contracts: [{ functionName: "getBid" }, { functionName: "getListing" }] },
    ]);

    expect(predicate(query)).toBe(true);
  });

  test("does not match readContracts when no contract functionName matches", () => {
    const predicate = matchesFunctionName(["getListing"]);
    const query = fakeQuery([
      "readContracts",
      { contracts: [{ functionName: "getBid" }] },
    ]);

    expect(predicate(query)).toBe(false);
  });

  test("does not match unrelated query keys", () => {
    const predicate = matchesFunctionName(["listingCount"]);
    const query = fakeQuery(["someOtherKey", {}]);

    expect(predicate(query)).toBe(false);
  });

  test("matches readContract addresses case-insensitively", () => {
    const predicate = matchesContract(MARKET_ADDRESS);
    const query = fakeQuery([
      "readContract",
      { address: MARKET_ADDRESS.toLowerCase() },
    ]);

    expect(predicate(query)).toBe(true);
  });

  test("matches any readContracts contract address case-insensitively", () => {
    const predicate = matchesContract(MARKET_ADDRESS);
    const query = fakeQuery([
      "readContracts",
      { contracts: [{ address: ASSETS_ADDRESS }, { address: MARKET_ADDRESS.toLowerCase() }] },
    ]);

    expect(predicate(query)).toBe(true);
  });

  test("matchesAll requires every predicate to match and at least one predicate", () => {
    const functionPredicate = matchesFunctionName(["getListing"]);
    const contractPredicate = matchesContract(MARKET_ADDRESS);
    const query = fakeQuery([
      "readContracts",
      { contracts: [{ address: MARKET_ADDRESS, functionName: "getListing" }] },
    ]);

    expect(matchesAll(functionPredicate, contractPredicate)(query)).toBe(true);
    expect(matchesAll(functionPredicate, matchesContract(ASSETS_ADDRESS))(query)).toBe(false);
    expect(matchesAll()(query)).toBe(false);
  });

  test("matchesAny accepts any matching predicate and rejects empty predicate lists", () => {
    const functionPredicate = matchesFunctionName(["getListing"]);
    const contractPredicate = matchesContract(ASSETS_ADDRESS);
    const query = fakeQuery([
      "readContracts",
      { contracts: [{ address: MARKET_ADDRESS, functionName: "getListing" }] },
    ]);

    expect(matchesAny(functionPredicate, contractPredicate)(query)).toBe(true);
    expect(matchesAny(matchesFunctionName(["getBid"]), contractPredicate)(query)).toBe(false);
    expect(matchesAny()(query)).toBe(false);
  });
});
