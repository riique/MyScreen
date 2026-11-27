import { readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AppSettings } from "../shared/ipc";
import { DEFAULT_MEDIA_PREFS, parseMediaPrefs } from "../shared/media";
import { isUnattendedCredential, type UnattendedCredential } from "../shared/remote/unattendedAuth";
import { normalizeServerUrl } from "./security";

/**
 * Configurações do app, num JSON em `userData`. O apelido mora aqui, e não
 * só no localStorage, porque o Chromium grava o localStorage com atraso e
 * perde a escrita quando o app é fechado à força. Nunca guarda senha de sala:
 * ela vive só na memória da sessão, para o refresh do token.
 *
 * A credencial de acesso direto (`unattendedAccess`: salt + chave PBKDF2) fica
 * só no processo principal; `AppSettings` expõe apenas `unattendedAccessEnabled`.
 */

declare const __MYSCREEN_SERVER_URL__: string;

export const DEFAULT_SERVER_URL =
  normalizeServerUrl(process.env.MYSCREEN_SERVER_URL || __MYSCREEN_SERVER_URL__) ?? "https://myscreen.haumea.fun";

const DEFAULTS: AppSettings = {
  serverUrl: DEFAULT_SERVER_URL,
  shortcutsEnabled: true,
  nickname: "",
  autoDownloadUpdates: true,
  remoteControlDisabled: false,
  unattendedAccessEnabled: false,
  soundboardEnabled: false,
  media: DEFAULT_MEDIA_PREFS,
};

interface StoredState {
  public: AppSettings;
  unattended: UnattendedCredential | null;
}

let current: StoredState | null = null;

function file(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function parse(raw: unknown, keepUnattended: UnattendedCredential | null = null): StoredState {
  const out = { ...DEFAULTS };
  let unattended = keepUnattended;
  if (typeof raw === "object" && raw !== null) {
    const v = raw as Record<string, unknown>;
    if (typeof v.serverUrl === "string") out.serverUrl = normalizeServerUrl(v.serverUrl) ?? DEFAULTS.serverUrl;
    if (typeof v.shortcutsEnabled === "boolean") out.shortcutsEnabled = v.shortcutsEnabled;
    if (typeof v.autoDownloadUpdates === "boolean") out.autoDownloadUpdates = v.autoDownloadUpdates;
    if (typeof v.remoteControlDisabled === "boolean") out.remoteControlDisabled = v.remoteControlDisabled;
    if (typeof v.soundboardEnabled === "boolean") out.soundboardEnabled = v.soundboardEnabled;
    if (typeof v.nickname === "string") out.nickname = v.nickname.trim().slice(0, 64);
    if ("unattendedAccess" in v) {
      unattended = isUnattendedCredential(v.unattendedAccess) ? v.unattendedAccess : null;
    }
    out.media = parseMediaPrefs(v.media);
  }
  out.unattendedAccessEnabled = unattended !== null;
  return { public: out, unattended };
}

function load(): StoredState {
  if (current) return current;
  try {
    current = parse(JSON.parse(readFileSync(file(), "utf8")));
  } catch {
    current = { public: { ...DEFAULTS }, unattended: null };
  }
  return current;
}

function persist(state: StoredState): void {
  try {
    mkdirSync(path.dirname(file()), { recursive: true });
    // Grava num temporário e renomeia: um crash no meio não deixa JSON pela metade.
    const tmp = `${file()}.tmp`;
    const payload = {
      ...state.public,
      unattendedAccess: state.unattended,
    };
    writeFileSync(tmp, JSON.stringify(payload, null, 2));
    renameSync(tmp, file());
  } catch (error) {
    console.error("Não foi possível salvar as configurações:", error);
  }
}

export function getSettings(): AppSettings {
  return load().public;
}

export function getUnattendedCredential(): UnattendedCredential | null {
  return load().unattended;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const prev = load();
  const next = parse({ ...prev.public, ...patch }, prev.unattended);
  current = next;
  persist(next);
  return next.public;
}

export function setUnattendedCredential(cred: UnattendedCredential | null): AppSettings {
  const prev = load();
  const next: StoredState = {
    public: { ...prev.public, unattendedAccessEnabled: cred !== null },
    unattended: cred,
  };
  current = next;
  persist(next);
  return next.public;
}
