import { describe, expect, test } from "vitest";
import { buildTxExplorerUrl } from "../components/ui/TxToast";

describe("buildTxExplorerUrl", () => {
  test("拼接 explorer 交易链接时去除末尾斜杠", () => {
    expect(buildTxExplorerUrl("https://testnet.arcscan.app/", "0xabc")).toBe(
      "https://testnet.arcscan.app/tx/0xabc",
    );
  });
});
