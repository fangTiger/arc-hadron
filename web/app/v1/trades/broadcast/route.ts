import { broadcastSignedTransactionPayload } from "@/lib/api/trading";
import { readJsonBody, withTradingApiKey } from "@/lib/api/tradingRoutes";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withTradingApiKey(request, async () =>
    broadcastSignedTransactionPayload(await readJsonBody(request)),
  );
}
