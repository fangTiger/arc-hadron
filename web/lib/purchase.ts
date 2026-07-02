export const GAS_BUFFER = 10_000_000_000_000_000n;

export interface ValidatePurchaseInput {
  amountInput: string;
  remaining: bigint;
  balance: bigint;
  pricePerShare: bigint;
}

export type PurchaseValidationResult =
  | { ok: true; amount: bigint; totalValue: bigint }
  | { ok: false; errorZh: string };

export function validatePurchase({
  amountInput,
  remaining,
  balance,
  pricePerShare,
}: ValidatePurchaseInput): PurchaseValidationResult {
  const normalized = amountInput.trim();

  if (!/^\d+$/.test(normalized)) {
    return { ok: false, errorZh: "请输入有效的购买数量" };
  }

  const amount = BigInt(normalized);

  if (amount === 0n) {
    return { ok: false, errorZh: "请输入有效的购买数量" };
  }

  if (amount > remaining) {
    return { ok: false, errorZh: "超出发行余量" };
  }

  const totalValue = amount * pricePerShare;

  if (totalValue + GAS_BUFFER > balance) {
    return { ok: false, errorZh: "USDC 余额不足" };
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
    return "已取消签名";
  }

  if (lowerMessage.includes("insufficient funds")) {
    return "余额不足以支付交易";
  }

  return "交易失败，请稍后重试";
}
