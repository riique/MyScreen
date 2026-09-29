/**
 * Copia texto com degradacao explicita.
 *
 * `navigator.clipboard` nao existe em contexto nao seguro (http://IP da rede
 * local — que e o cenario-alvo de "servidor proprio") e pode ser bloqueado por
 * politica de empresa. Sem guarda, a chamada lanca `TypeError` de forma
 * sincrona e o `setCopied(true)` seguinte nunca roda: o botao "copiar link"
 * fica sem feedback nenhum e parece quebrado.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // contexto seguro mas bloqueado — tenta o caminho legado
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
