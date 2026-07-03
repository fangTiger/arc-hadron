import { describe, expect, test } from "vitest";
import HadronMarketAbi from "../lib/abi/HadronMarket.json";

function abiNames(type: string): string[] {
  return HadronMarketAbi.flatMap((item) =>
    "type" in item && item.type === type && "name" in item ? [item.name] : [],
  );
}

describe("HadronMarket ABI", () => {
  test("exposes bid read and write functions from the deployed market contract", () => {
    expect(abiNames("function")).toEqual(
      expect.arrayContaining([
        "bidCount",
        "bidsByToken",
        "cancelBid",
        "fillBid",
        "getBid",
        "placeBid",
      ]),
    );
  });

  test("exposes bid events and bid errors for frontend decoding", () => {
    expect(abiNames("event")).toEqual(
      expect.arrayContaining(["BidCancelled", "BidFilled", "BidPlaced"]),
    );
    expect(abiNames("error")).toEqual(
      expect.arrayContaining(["BidderNotReceiver", "InactiveBid", "NotBidder"]),
    );
  });
});
