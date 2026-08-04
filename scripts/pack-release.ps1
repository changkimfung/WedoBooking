# 打包 PmDemo 发布目录（不含 node_modules / .git）
param(
  [string]$OutDir = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Stage = Join-Path $OutDir "pm-demo-$Stamp"
$Zip = Join-Path $OutDir "pm-demo-$Stamp.zip"

$ExcludeDirs = @("node_modules", ".git", ".vscode", ".vercel", "dist")
$ExcludeFiles = @(".env", "debug.log")

New-Item -ItemType Directory -Force -Path $Stage | Out-Null

Get-ChildItem -Path $Root -Force | ForEach-Object {
  if ($ExcludeDirs -contains $_.Name) { return }
  if ($ExcludeFiles -contains $_.Name) { return }
  Copy-Item -Path $_.FullName -Destination (Join-Path $Stage $_.Name) -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -Force
Remove-Item $Stage -Recurse -Force

Write-Host "Release package: $Zip"
Write-Host "Upload to server, then:"
Write-Host "  unzip pm-demo-*.zip -d /path/to/pm-demo"
Write-Host "  cd /path/to/pm-demo && npm install --production"
Write-Host "  cp .env.example .env   # edit SMTP if needed"
Write-Host "  PORT=3847 pm2 start ecosystem.config.cjs"
