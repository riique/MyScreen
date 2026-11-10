// Main, preloads e os utility processes (áudio e controle remoto): CommonJS para o Node do Electron.
// O preload roda com sandbox: vai num arquivo só, sem require além de "electron".
export function mainBuildOptions({ production }) {
  const helper = new URL("../native/target/release/myscreen-uac.exe", import.meta.url);
  const uacHash = production && existsSync(helper) ? createHash("sha256").update(readFileSync(helper)).digest("hex") : null;
  return {
    entryPoints: {
      "main/index": "src/main/index.ts",
      "preload/index": "src/preload/index.ts",
      "audio/worker": "src/audio/worker.ts",
      "input/worker": "src/input/worker.ts",
    },
    outdir: "dist",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron", "electron-updater"],
    sourcemap: production ? false : "inline",
    minify: production,
    logLevel: "info",
    define: {
      __MYSCREEN_SERVER_URL__: JSON.stringify(process.env.MYSCREEN_SERVER_URL || "https://myscreen.haumea.fun"),
      __MYSCREEN_UAC_SHA256__: JSON.stringify(uacHash),
      __MYSCREEN_UAC_SCRIPT__: JSON.stringify(uacHash
        ? readFileSync(new URL("./manage-uac-service.ps1", import.meta.url), "utf8").replace(/^\uFEFF/, "")
        : ""),
    },
  };
}
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
