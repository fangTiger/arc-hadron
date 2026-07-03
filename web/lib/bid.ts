import { GAS_BUFFER } from "@/lib/purchase";
import { sharePriceInputToUnitPrice, unitsFromSharesInput } from "@/lib/shares";

interface ValidateBidPlacementInput {
  amountInput: string;
  priceInput: string;
  balance: bigint;
}

interface ValidateBidFillInput {
  amountInput: string;
  balance: bigint;
  remaining: bigint;
}

export type BidPlacementValidationResult =
  | { ok: true; amount: bigint; pricePerShare: bigint; totalValue: bigint }
  | { ok: false; errorText: string };

export type BidFillValidationResult =
  | { ok: true; amount: bigint; totalValue: bigint }
  | { ok: false; errorText: string };

export function validateBidPlacement({
  amountInput,
  balance,
  priceInput,
}: ValidateBidPlacementInput): BidPlacementValidationResult {
  let amount: bigint;

  try {
    amount = unitsFromSharesInput(amountInput);
  } catch {
    return { ok: false, errorText: "Enter a valid amount" };
  }

  let pricePerShare: bigint;

  try {
    pricePerShare = sharePriceInputToUnitPrice(priceInput);
  } catch {
    return { ok: false, errorText: "Enter a valid price" };
  }

  if (pricePerShare === 0n) {
    return { ok: false, errorText: "Enter a valid price" };
  }

  const totalValue = amount * pricePerShare;

  if (totalValue + GAS_BUFFER > balance) {
    return { ok: false, errorText: "Insufficient USDC balance" };
  }

  return { ok: true, amount, pricePerShare, totalValue };
}

export function validateBidFill({
  amountInput,
  balance,
  remaining,
}: ValidateBidFillInput): BidFillValidationResult {
  if (balance === 0n) {
    return { ok: false, errorText: "No shares available to fill this bid" };
  }

  let amount: bigint;

  try {
    amount = unitsFromSharesInput(amountInput);
  } catch {
    return { ok: false, errorText: "Enter a valid amount" };
  }

  if (amount > remaining) {
    return { ok: false, errorText: "Exceeds available bid" };
  }

  if (amount > balance) {
    return { ok: false, errorText: "Exceeds your balance" };
  }

  return { ok: true, amount, totalValue: 0n };
}
