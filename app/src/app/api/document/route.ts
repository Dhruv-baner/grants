import { handleDocument } from "@/lib/live";
import { defaultDeps } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
export async function POST(req: Request) { return handleDocument(req, defaultDeps()); }
