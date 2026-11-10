import { NextResponse } from "next/server";

/** Rótulos humanos: a mensagem de erro vai para a tela do usuário, e ninguém
 *  deve ver `Campo "password"` num formulário em português. */
const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  password: "A senha",
  title: "O título",
  customId: "O ID da sala",
  roomId: "O ID da sala",
  nickname: "O apelido",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? `O campo "${field}"`;
}

/** Erro de entrada do cliente. Distingue 4xx de "algo quebrou no servidor". */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Nome técnico do campo, para a UI marcar só o input culpado. */
    readonly field?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface StringRule {
  min?: number;
  max: number;
  pattern?: RegExp;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export { EMAIL_PATTERN };

/**
 * Le um campo obrigatorio de texto com teto de tamanho.
 *
 * Antes disso nao existia validacao nenhuma: `{ email: 123 }` caia no catch e
 * virava 500, e sem teto de tamanho um payload grande virava DoS de CPU no
 * bcrypt (que ficou 4x mais caro com o custo 12).
 */
export function str(body: Record<string, unknown>, field: string, opts: StringRule): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldLabel(field)} deve ser preenchido.`, field);
  }
  const trimmed = value.trim();
  const min = opts.min ?? 1;
  if (trimmed.length < min) {
    throw new HttpError(
      400,
      `${fieldLabel(field)} deve ter no mínimo ${min} caracteres.`,
      field
    );
  }
  if (trimmed.length > opts.max) {
    throw new HttpError(
      400,
      `${fieldLabel(field)} deve ter no máximo ${opts.max} caracteres.`,
      field
    );
  }
  if (opts.pattern && !opts.pattern.test(trimmed)) {
    throw new HttpError(400, `${fieldLabel(field)} tem formato inválido.`, field);
  }
  return trimmed;
}

/**
 * Envolve um handler de rota e traduz `HttpError` em resposta, sem engolir
 * excecoes inesperadas: essas continuam sendo logadas e viram 500 opaco.
 *
 * O corpo inclui `field` para que o formulário marque apenas o input culpado
 * — antes ele pintava de vermelho todos os campos, inclusive os corretos.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<NextResponse>
) {
  return async (req: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.message, field: err.field ?? null },
          { status: err.status, headers: err.status === 429 ? { "Retry-After": "900" } : undefined }
        );
      }
      console.error("Erro não tratado na rota:", err);
      return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
    }
  };
}
