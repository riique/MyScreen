import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/validate";
import { isSoundFileName, MAX_SOUND_BYTES, SOUND_TYPES, soundsDir } from "@/lib/sounds";

export const dynamic = "force-dynamic";

/** O arquivo de um áudio, pelo nome que a lista devolveu. */
async function handleGet(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-get", 60, 60_000);

  const { id } = await params;
  if (!isSoundFileName(id)) {
    return NextResponse.json({ error: "Áudio não encontrado." }, { status: 404 });
  }
  const file = path.join(soundsDir(), id);
  try {
    const s = await stat(file);
    if (!s.isFile() || s.size > MAX_SOUND_BYTES) throw new Error("fora do limite");
  } catch {
    return NextResponse.json({ error: "Áudio não encontrado." }, { status: 404 });
  }
  const bytes = await readFile(file);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": SOUND_TYPES[path.extname(id).toLowerCase()],
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-cache",
    },
  });
}

export const GET = withErrorHandling(handleGet);
