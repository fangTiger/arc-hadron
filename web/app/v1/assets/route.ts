import { loadAssetsSnapshot } from "@/lib/api/marketSnapshotCache";
import { jsonOk, jsonUpstreamError } from "@/lib/api/publicRoutes";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    return jsonOk(await loadAssetsSnapshot());
  } catch {
    return jsonUpstreamError();
  }
}
