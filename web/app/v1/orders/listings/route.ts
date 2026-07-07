import { loadListingsPayload } from "@/lib/api/publicQuery";
import {
  jsonOk,
  jsonQueryError,
  jsonUpstreamError,
  parseOptionalAddressParam,
  parseOptionalBigIntParam,
  QueryParamError,
} from "@/lib/api/publicRoutes";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  try {
    return jsonOk(
      await loadListingsPayload({
        seller: parseOptionalAddressParam(params, "seller"),
        tokenId: parseOptionalBigIntParam(params, "tokenId"),
      }),
    );
  } catch (error) {
    if (error instanceof QueryParamError) {
      return jsonQueryError(error.message);
    }

    return jsonUpstreamError();
  }
}
