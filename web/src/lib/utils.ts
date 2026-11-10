import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROOM_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/**
 * Comprimento maximo de um id de sala. O id gerado tem 9 caracteres e o
 * customizado aceita ate 32; 64 deixa folga para salas efemeras, que sao
 * validas mesmo sem registro no banco. O teto importa porque o id entra em
 * `findUnique` cru, vindo de um segmento de path.
 */
export const MAX_ROOM_ID_LENGTH = 64;

/** Forma canonica de um id de sala: minusculo, sem espaco nas pontas, com teto. */
export function normalizeRoomId(raw: string): string {
  return raw.trim().toLowerCase().slice(0, MAX_ROOM_ID_LENGTH);
}

/**
 * O id da sala protege o acesso a reuniao, entao precisa de fonte imprevisivel.
 * `Math.random()` no V8 e xorshift128+: o estado e recuperavel a partir de
 * algumas amostras o suficiente para adivinhar ids vizinhos.
 *
 * A rejeicao de modulo (`byte % 26`) enviesa levemente a distribuicao (256 nao
 * e multiplo de 26). Com 9 caracteres a chance de colisao continua desprezivel,
 * e o alternativa seria um alphabet de 32 caracteres com rejection sampling.
 */
export function generateRoomId(length = 9): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ROOM_ID_ALPHABET[byte % ROOM_ID_ALPHABET.length]).join("");
}
