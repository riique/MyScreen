import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { uacSetupArgs } from "../src/main/uacSetup";

const hash = "a".repeat(64);
const nonce = "b".repeat(64);
const source = "C:\\MyScreen de João d'Ávila e d’André\\myscreen-uac.exe";
const encodedSource = Buffer.from(source, "utf8").toString("base64");

it("cita o caminho e passa só dados fixos para o PowerShell elevado", () => {
  const script = readFileSync("scripts/manage-uac-service.ps1", "utf8").replace(/^\uFEFF/, "");
  const args = uacSetupArgs(script, source, hash, 1234, nonce);
  expect(args.length).toBeLessThan(30_000);
  const command = Buffer.from(args.split(" ").at(-1)!, "base64").toString("utf16le");
  expect(command).toContain("} -EnsureInstalled -Source ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
    encodedSource + "'))) -ExpectedSha256 '" + hash + "'");
  expect(command).not.toContain(source);
  expect(command).toContain("-ArgumentList @('--authorize', '1234', '" + nonce + "')");
  expect(command).not.toContain("#Requires");
});

it.skipIf(process.platform !== "win32")("o PowerShell recebe o caminho, o hash e o modo de preparo sem executar instalação", () => {
  const stub = [
    "param($Source, $ExpectedSha256, [switch] $EnsureInstalled)",
    "if ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Source)) -eq '" + encodedSource + "' -and $ExpectedSha256 -eq '" + hash +
      "' -and $EnsureInstalled) { exit 37 }",
    "exit 2",
  ].join("\n");
  const exe = path.join(process.env.SystemRoot!, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  expect(() => execFileSync(exe, uacSetupArgs(stub, source, hash, 1234, nonce).split(" "), {
    windowsHide: true, timeout: 8000,
  })).toThrow(expect.objectContaining({ status: 37 }));
});
