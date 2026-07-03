import { describe, expect, test } from "vitest";
import * as TxToast from "../components/ui/TxToast";

const { buildTxExplorerUrl } = TxToast;

describe("buildTxExplorerUrl", () => {
  test("removes the trailing slash when building explorer transaction links", () => {
    expect(buildTxExplorerUrl("https://testnet.arcscan.app/", "0xabc")).toBe(
      "https://testnet.arcscan.app/tx/0xabc",
    );
  });
});

describe("toast motion", () => {
  test("uses slide and fade classes with reduced-motion fallbacks", () => {
    const toastModule = TxToast as typeof TxToast & {
      toastMotionClassName?: (isClosing: boolean) => string;
    };

    expect(toastModule.toastMotionClassName).toBeTypeOf("function");

    const entered = toastModule.toastMotionClassName?.(false) ?? "";
    const exiting = toastModule.toastMotionClassName?.(true) ?? "";

    expect(entered).toContain("translate-y-0");
    expect(entered).toContain("opacity-100");
    expect(exiting).toContain("translate-y-2");
    expect(exiting).toContain("opacity-0");
    expect(entered).toContain("motion-reduce:transition-none");
    expect(exiting).toContain("motion-reduce:translate-y-0");
  });
});
