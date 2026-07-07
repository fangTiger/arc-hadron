import { loadTradesPayload } from "@/lib/api/publicQuery";
import {
  jsonOk,
  jsonQueryError,
  jsonUpstreamError,
  parseLimitParam,
  parseOptionalBigIntParam,
  parseTradeEventType,
  QueryParamError,
} from "@/lib/api/publicRoutes";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  try {
    return jsonOk(
      await loadTradesPayload({
        limit: parseLimitParam(params),
        tokenId: parseOptionalBigIntParam(params, "tokenId"),
        type: parseTradeEventType(params),
      }),
    );
  } catch (error) {
    if (error instanceof QueryParamError) {
      return jsonQueryError(error.message);
    }

    return jsonUpstreamError();
  }
}
