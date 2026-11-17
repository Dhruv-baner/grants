import { handleStatus } from "@/lib/live";
import { defaultDeps } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() { return handleStatus(defaultDeps()); }
