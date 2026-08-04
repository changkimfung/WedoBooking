# 上传发布包到腾讯 CVM 并重启服务
# 用法:
#   .\scripts\deploy-tencent.ps1 -ServerHost 1.2.3.4 -User root -RemoteDir /var/www/pm-demo
param(
  [Parameter(Mandatory = $true)][string]$ServerHost,
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$RemoteDir,
  [string]$IdentityFile = "",
  [int]$Port = 3847
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PackScript = Join-Path $PSScriptRoot "pack-release.ps1"

& $PackScript
$Zip = Get-ChildItem (Join-Path $Root "dist") -Filter "pm-demo-*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Zip) { throw "No release zip found in dist/" }

$SshArgs = @()
if ($IdentityFile) { $SshArgs += @("-i", $IdentityFile) }
$Target = "$User@$ServerHost"
$ZipName = $Zip.Name
$RemoteZip = "$RemoteDir/$ZipName"

Write-Host "Uploading $($Zip.FullName) -> ${Target}:${RemoteZip}"
scp @SshArgs $Zip.FullName "${Target}:$RemoteZip"

$RemoteCmd = "set -e`n" +
  "mkdir -p '$RemoteDir'`n" +
  "cd '$RemoteDir'`n" +
  "unzip -o '$ZipName'`n" +
  "source /root/.nvm/nvm.sh`n" +
  "npm install --production`n" +
  "if [ ! -f .env ]; then cp .env.example .env; fi`n" +
  "pm2 startOrReload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs`n" +
  "pm2 save"

Write-Host "Running remote deploy..."
ssh @SshArgs $Target $RemoteCmd
Write-Host "Done. Check http://${ServerHost}:${Port}/customer/deliveryAppointment.html"
