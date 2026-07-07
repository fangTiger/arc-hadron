import { loadTransactionStatusPayload } from "@/lib/api/trading";
import { routeParams, withTradingApiKey } from "@/lib/api/tradingRoutes";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ txHash: string }> },
): Promise<Response> {
  return withTradingApiKey(request, async () => {
    const { txHash } = await routeParams(context);

    return loadTransactionStatusPayload({ txHash });
  });
}
