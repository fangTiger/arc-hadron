import { prepareBuyListingPayload } from "@/lib/api/trading";
import { readJsonBody, routeParams, withTradingApiKey } from "@/lib/api/tradingRoutes";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
): Promise<Response> {
  return withTradingApiKey(request, async () => {
    const { listingId } = await routeParams(context);

    return prepareBuyListingPayload({
      body: await readJsonBody(request),
      listingId,
    });
  });
}
