import { createBriefRouteHandler } from "@/lib/ai/routeShared";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = createBriefRouteHandler();
