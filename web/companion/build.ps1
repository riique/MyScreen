# Gera o app e o instalador (que embute o app).
# Saida: target\release\MyScreenAudio-Setup.exe
Set-Location $PSScriptRoot
cargo build --release
if ($LASTEXITCODE -ne 0) { exit 1 }
Push-Location installer
cargo build --release --target-dir ..\target
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { exit 1 }
Copy-Item target\release\myscreen-audio-setup.exe target\release\MyScreenAudio-Setup.exe -Force
Get-Item target\release\MyScreenAudio-Setup.exe | Select-Object Name, Length
