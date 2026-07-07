import { prepareFillBidPayload } from "@/lib/api/trading";
import { readJsonBody, routeParams, withTradingApiKey } from "@/lib/api/tradingRoutes";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ bidId: string }> },
): Promise<Response> {
  return withTradingApiKey(request, async () => {
    const { bidId } = await routeParams(context);

    return prepareFillBidPayload({
      bidId,
      body: await readJsonBody(request),
    });
  });
}
