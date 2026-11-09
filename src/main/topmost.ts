/**
 * Ponte para o vigia nativo de "sempre no topo" (native/src/topmost.rs).
 *
 * O addon só é carregado no processo principal quando a primeira janela é
 * fixada. Se faltar (build sem o addon) ou falhar, `pin` devolve `false` e
 * quem chamou fica com o plano B do Electron.
 */

import type { BrowserWindow } from "electron";
import { nativeModulePath } from "./audio";

type TopmostNative = {
  pinTopmost(hwnd: number): void;
  unpinTopmost(hwnd: number): void;
};

let native: TopmostNative | null = null;
let failed = false;

function load(): TopmostNative | null {
  if (native || failed || process.platform !== "win32") return native;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(nativeModulePath()) as Partial<TopmostNative>;
    if (typeof mod.pinTopmost !== "function" || typeof mod.unpinTopmost !== "function") throw new Error("addon antigo");
    native = mod as TopmostNative;
  } catch (error) {
    failed = true;
    console.warn("[topmost] vigia nativo indisponível:", error instanceof Error ? error.message : error);
  }
  return native;
}

/** O HWND da janela como número (os bits altos de um HWND são sempre zero na prática). */
export function hwndOf(win: BrowserWindow): number {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}

export function pinNative(win: BrowserWindow): boolean {
  const n = load();
  if (!n) return false;
  try {
    n.pinTopmost(hwndOf(win));
    return true;
  } catch (error) {
    console.warn("[topmost] pin falhou:", error);
    return false;
  }
}

export function unpinNative(win: BrowserWindow, hwnd = hwndOf(win)): void {
  try {
    native?.unpinTopmost(hwnd);
  } catch {
    /* janela já destruída: o vigia limpa sozinho */
  }
}
