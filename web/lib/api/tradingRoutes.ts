import { requireApiKey } from "@/lib/api/apiKeys";
import {
  jsonInvalidOrder,
  jsonNoStoreOk,
  jsonTradingUpstreamError,
} from "@/lib/api/publicRoutes";
import { TradingInputError } from "@/lib/api/trading";

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TradingInputError("Request body must be valid JSON.");
  }
}

export async function routeParams<T>(context: { params: Promise<T> }): Promise<T> {
  return context.params;
}

export async function withTradingApiKey(
  request: Request,
  action: () => Promise<unknown>,
): Promise<Response> {
  const authError = requireApiKey(request);

  if (authError) {
    return authError;
  }

  try {
    return jsonNoStoreOk(await action());
  } catch (error) {
    if (error instanceof TradingInputError) {
      return jsonInvalidOrder(error.message);
    }

    return jsonTradingUpstreamError();
  }
}
