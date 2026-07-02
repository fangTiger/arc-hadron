import { describe, expect, test } from "vitest";
import { buildTxExplorerUrl } from "../components/ui/TxToast";

describe("buildTxExplorerUrl", () => {
  test("removes the trailing slash when building explorer transaction links", () => {
    expect(buildTxExplorerUrl("https://testnet.arcscan.app/", "0xabc")).toBe(
      "https://testnet.arcscan.app/tx/0xabc",
    );
  });
});
