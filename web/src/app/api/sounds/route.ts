import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireRoomCaller } from "@/lib/room-auth";
import { HttpError, withErrorHandling } from "@/lib/validate";
import { listSounds, MAX_SOUND_BYTES, MAX_SOUNDS, saveSound, soundCount, soundFileNameFrom } from "@/lib/sounds";

export const dynamic = "force-dynamic";

/** Lista os áudios que podem ser tocados numa chamada. */
async function handleList(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-list", 120, 60_000);
  const sounds = await listSounds();
  return NextResponse.json({ sounds }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Qualquer pessoa numa sala pode mandar um áudio do computador para a pasta
 * do servidor; ele entra na lista de todo mundo na hora. O token da sala é a
 * única credencial: quem nunca entrou numa sala não enche o disco.
 *
 * Corpo: `multipart/form-data` com o campo `file`.
 */
async function handleUpload(req: Request): Promise<NextResponse> {
  enforceRateLimit(req, "sounds-upload", 20, 10 * 60_000);
  await requireRoomCaller(req);

  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_SOUND_BYTES + 64 * 1024) {
    throw new HttpError(413, `Áudio grande demais. O limite é ${MAX_SOUND_BYTES / 1024 / 1024} MB.`);
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Escolha um arquivo de áudio.");
  if (file.size === 0) throw new HttpError(400, "O arquivo está vazio.");
  if (file.size > MAX_SOUND_BYTES) {
    throw new HttpError(413, `Áudio grande demais. O limite é ${MAX_SOUND_BYTES / 1024 / 1024} MB.`);
  }
  const fileName = soundFileNameFrom(file.name);
  if (!fileName) {
    throw new HttpError(415, "Formato não suportado. Use MP3, WAV, OGG, OPUS, M4A, AAC, FLAC ou WEBM.");
  }
  if ((await soundCount()) >= MAX_SOUNDS) {
    throw new HttpError(507, "A lista de áudios do servidor está cheia.");
  }

  const sound = await saveSound(fileName, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ sound }, { status: 201 });
}

export const GET = withErrorHandling(handleList);
export const POST = withErrorHandling(handleUpload);
