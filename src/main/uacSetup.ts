/** O script e o SHA-256 vêm do build. Nenhum trecho vem do participante remoto. */
export function uacSetupArgs(script: string, source: string, sha256: string, pid: number, nonce: string): string {
  // O PowerShell também interpreta aspas tipográficas. Transporte o caminho
  // como dados para que qualquer nome de pasta chegue literal ao instalador.
  const encodedSource = Buffer.from(source, "utf8").toString("base64");
  const body = [
    "$ErrorActionPreference = 'Stop'",
    "$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')",
    "Set-Location -LiteralPath $PSHOME",
    "try {",
    "& {",
    script.replace(/^#Requires -RunAsAdministrator\r?\n/, ""),
    "} -EnsureInstalled -Source ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" +
      encodedSource + "'))) -ExpectedSha256 '" + sha256 + "'",
    "$root = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)",
    "$exe = [IO.Path]::Combine($root, 'MyScreen UAC', 'myscreen-uac.exe')",
    "$worker = Start-Process -FilePath $exe -WindowStyle Hidden -Wait -PassThru -ArgumentList @('--authorize', " +
      "'" + pid + "', '" + nonce + "')",
    "exit $worker.ExitCode",
    "} catch { exit 1 }",
  ].join("\n");
  return "-NoLogo -NoProfile -NonInteractive -EncodedCommand " + Buffer.from(body, "utf16le").toString("base64");
}
