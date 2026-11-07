/** O script e o SHA-256 vêm do build. Nenhum trecho vem do participante remoto. */
export function uacSetupArgs(script: string, source: string, sha256: string, pid: number, nonce: string): string {
  const psLiteral = (value: string) => "'" + value.replace(/'/g, "''") + "'";
  const body = [
    "$ErrorActionPreference = 'Stop'",
    "$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')",
    "Set-Location -LiteralPath $PSHOME",
    "try {",
    "& {",
    script.replace(/^#Requires -RunAsAdministrator\r?\n/, ""),
    "} -EnsureInstalled -Source " + psLiteral(source) + " -ExpectedSha256 " + psLiteral(sha256),
    "$root = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)",
    "$exe = [IO.Path]::Combine($root, 'MyScreen UAC', 'myscreen-uac.exe')",
    "$worker = Start-Process -FilePath $exe -WindowStyle Hidden -Wait -PassThru -ArgumentList @('--authorize', " +
      psLiteral(String(pid)) + ", " + psLiteral(nonce) + ")",
    "exit $worker.ExitCode",
    "} catch { exit 1 }",
  ].join("\n");
  return "-NoLogo -NoProfile -NonInteractive -EncodedCommand " + Buffer.from(body, "utf16le").toString("base64");
}
