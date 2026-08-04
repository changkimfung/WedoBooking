# PmDemo dev server - Windows firewall inbound rule (run as Administrator)
# Usage: Right-click PowerShell -> Run as administrator ->
#   Set-Location D:\Wedo\PmDemo; .\scripts\open-firewall.ps1

$ErrorActionPreference = 'Stop'
$ruleName = 'PmDemo Dev Server'
$port = if ($env:PORT) { [int]$env:PORT } else { 3847 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Write-Host 'Please run this script as Administrator.' -ForegroundColor Red
  Write-Host 'Example:'
  Write-Host "  Set-Location D:\Wedo\PmDemo; .\scripts\open-firewall.ps1"
  exit 1
}

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Remove-NetFirewallRule -DisplayName $ruleName
}

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Description 'Allow inbound TCP for PmDemo npm run dev (scripts/dev-server.js)' `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort $port `
  -Action Allow `
  -Profile Any `
  -Enabled True | Out-Null

Write-Host "Firewall opened for inbound TCP port $port (rule: $ruleName)" -ForegroundColor Green
Write-Host ''
Write-Host 'LAN addresses (share with colleagues on same network):'
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  ForEach-Object {
    $ip = $_.IPAddress
    $alias = $_.InterfaceAlias
    Write-Host "  http://${ip}:$port/customer/deliveryAppointment.html  ($alias)"
  }
Write-Host ''
Write-Host 'Make sure npm run dev is running on this machine.'
