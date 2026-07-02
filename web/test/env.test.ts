import { describe, expect, test } from "vitest";
import {
  optionalPublicEnv,
  parsePublicIntEnv,
  readAddressEnv,
  requirePublicEnv,
} from "../lib/env";

describe("公开环境变量校验", () => {
  test("缺失必填变量时抛出中文说明", () => {
    expect(() => requirePublicEnv("NEXT_PUBLIC_ARC_RPC_URL", undefined)).toThrow(
      "缺少必填环境变量 NEXT_PUBLIC_ARC_RPC_URL，请检查 web/.env.local 或部署环境。",
    );
  });

  test("空白可选变量返回 undefined", () => {
    expect(optionalPublicEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "   ")).toBeUndefined();
  });

  test("链 ID 必须是正整数", () => {
    expect(parsePublicIntEnv("NEXT_PUBLIC_ARC_CHAIN_ID", "5042002")).toBe(5042002);
    expect(() => parsePublicIntEnv("NEXT_PUBLIC_ARC_CHAIN_ID", "5.5")).toThrow(
      "环境变量 NEXT_PUBLIC_ARC_CHAIN_ID 必须是正整数。",
    );
  });

  test("合约地址必须是 0x 格式地址", () => {
    expect(
      readAddressEnv("NEXT_PUBLIC_HADRON_ASSETS", "0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85"),
    ).toBe("0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85");

    expect(() => readAddressEnv("NEXT_PUBLIC_HADRON_ASSETS", "not-an-address")).toThrow(
      "环境变量 NEXT_PUBLIC_HADRON_ASSETS 必须是 0x 开头的 EVM 地址。",
    );
  });
});
