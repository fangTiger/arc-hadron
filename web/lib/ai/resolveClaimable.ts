export interface ClaimablePending {
  tokenId: bigint;
  amount: bigint;
}

export interface ClaimableEntry {
  tokenId: bigint;
  amount: bigint;
}

export interface ResolveClaimableInput {
  pending: readonly ClaimablePending[];
  asset?: bigint | null;
}

export interface ResolveClaimableResult {
  entries: ClaimableEntry[];
  total: bigint;
}

export function resolveClaimable(
  address: `0x${string}` | null | undefined,
  { asset, pending }: ResolveClaimableInput,
): ResolveClaimableResult {
  if (!address) {
    return { entries: [], total: 0n };
  }

  const entries = pending.filter(
    (item) => item.amount > 0n && (asset === undefined || asset === null || item.tokenId === asset),
  );
  const total = entries.reduce((sum, item) => sum + item.amount, 0n);

  return { entries, total };
}
