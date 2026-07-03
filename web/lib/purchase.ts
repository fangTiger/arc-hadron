import { unitsFromSharesInput } from "@/lib/shares";

export const GAS_BUFFER = 10_000_000_000_000_000n;

export interface ValidatePurchaseInput {
  amountInput: string;
  remaining: bigint;
  balance: bigint;
  pricePerShare: bigint;
}

export type PurchaseValidationResult =
  | { ok: true; amount: bigint; totalValue: bigint }
  | { ok: false; errorText: string };

export function validatePurchase({
  amountInput,
  remaining,
  balance,
  pricePerShare,
}: ValidatePurchaseInput): PurchaseValidationResult {
  let amount: bigint;

  try {
    amount = unitsFromSharesInput(amountInput);
  } catch {
    return { ok: false, errorText: "Enter a valid amount" };
  }

  if (amount > remaining) {
    return { ok: false, errorText: "Exceeds available supply" };
  }

  const totalValue = amount * pricePerShare;

  if (totalValue + GAS_BUFFER > balance) {
    return { ok: false, errorText: "Insufficient USDC balance" };
  }

  return { ok: true, amount, totalValue };
}

function readErrorField(err: unknown, field: "name" | "message" | "shortMessage"): string {
  if (!err || typeof err !== "object" || !(field in err)) {
    return "";
  }

  const value = (err as Record<string, unknown>)[field];

  return typeof value === "string" ? value : "";
}

export function mapWagmiError(err: unknown): string {
  const name = readErrorField(err, "name");
  const message = [
    name,
    readErrorField(err, "message"),
    readErrorField(err, "shortMessage"),
  ].join(" ");
  const lowerMessage = message.toLowerCase();

  if (
    name === "UserRejectedRequestError" ||
    lowerMessage.includes("user rejected")
  ) {
    return "Signature cancelled";
  }

  if (lowerMessage.includes("insufficient funds")) {
    return "Insufficient funds for this transaction";
  }

  return "Transaction failed, please retry";
}
