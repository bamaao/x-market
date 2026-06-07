# P1.6 校验主网前端 env 模板是否已填写（发包前应为占位符）
param(
  [string]$EnvFile = "app/.env.mainnet.example"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$path = Join-Path $root $EnvFile
if (-not (Test-Path $path)) {
  Write-Host "Missing $EnvFile"
  exit 1
}

$required = @(
  "NEXT_PUBLIC_SUI_NETWORK=mainnet",
  "NEXT_PUBLIC_PACKAGE_ID=",
  "NEXT_PUBLIC_GLOBAL_CONFIG=",
  "NEXT_PUBLIC_ORACLE_CONFIG_ID=",
  "NEXT_PUBLIC_PROPHET_REGISTRY_ID=",
  "NEXT_PUBLIC_WALRUS_PUBLISHER_URL=",
  "NEXT_PUBLIC_GAS_STATION_URL="
)

$text = Get-Content $path -Raw
$missing = @()
foreach ($key in $required) {
  if ($text -notmatch [regex]::Escape($key.Split("=")[0])) {
    $missing += $key.Split("=")[0]
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing keys: $($missing -join ', ')"
  exit 1
}

if ($text -match "NEXT_PUBLIC_PACKAGE_ID=0x_MAINNET") {
  Write-Host "Template OK (placeholders — fill after mainnet deploy)"
} else {
  Write-Host "Mainnet env appears configured — review before production"
}
exit 0
