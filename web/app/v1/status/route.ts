import { loadStatusPayload } from "@/lib/api/publicQuery";
import { jsonOk, jsonUpstreamError } from "@/lib/api/publicRoutes";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return jsonOk(await loadStatusPayload());
  } catch {
    return jsonUpstreamError();
  }
}
