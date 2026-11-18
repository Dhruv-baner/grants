import { handleAsk } from "@/lib/live";
import { defaultDeps } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function POST(req: Request) { return handleAsk(req, defaultDeps()); }
