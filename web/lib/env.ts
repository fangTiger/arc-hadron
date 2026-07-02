import { isAddress, type Address } from "viem";

type PublicEnvName = `NEXT_PUBLIC_${string}`;

export function requirePublicEnv(name: PublicEnvName, value: string | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(
      `Missing required environment variable ${name}. Check web/.env.local or the deployment environment.`,
    );
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
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return parsed;
}

export function readAddressEnv(name: PublicEnvName, value: string | undefined): Address {
  const normalized = requirePublicEnv(name, value);

  if (!isAddress(normalized)) {
    throw new Error(`Environment variable ${name} must be a 0x-prefixed EVM address.`);
  }

  return normalized;
}
