import { isAddress, type Address } from "viem";

type PublicEnvName = `NEXT_PUBLIC_${string}`;

export function requirePublicEnv(name: PublicEnvName, value: string | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`缺少必填环境变量 ${name}，请检查 web/.env.local 或部署环境。`);
  }

  return normalized;
}

export function optionalPublicEnv(name: PublicEnvName, value: string | undefined): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

export function parsePublicIntEnv(name: PublicEnvName, value: string | undefined): number {
  const normalized = requirePublicEnv(name, value);
  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`环境变量 ${name} 必须是正整数。`);
  }

  return parsed;
}

export function readAddressEnv(name: PublicEnvName, value: string | undefined): Address {
  const normalized = requirePublicEnv(name, value);

  if (!isAddress(normalized)) {
    throw new Error(`环境变量 ${name} 必须是 0x 开头的 EVM 地址。`);
  }

  return normalized;
}
