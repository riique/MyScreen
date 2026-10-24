import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";
import { listSounds } from "@/lib/sounds";

export const dynamic = "force-dynamic";

/** Lista os áudios que podem ser tocados numa chamada. */
async function handleList(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-list", 120, 60_000);
  const sounds = await listSounds();
  return NextResponse.json({ sounds }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withErrorHandling(handleList);
