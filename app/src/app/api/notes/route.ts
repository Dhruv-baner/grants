import { handleNotes } from "@/lib/live";
import { defaultDeps } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
export async function POST(req: Request) { return handleNotes(req, defaultDeps()); }
