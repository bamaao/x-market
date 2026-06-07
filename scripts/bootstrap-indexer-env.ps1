# 生成 Indexer .env.local + 更新 app NEXT_PUBLIC_INDEXER_URL
param(
  [string]$DeployJson = "deploy/testnet-v2.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$deploy = Get-Content (Join-Path $root $DeployJson) -Raw | ConvertFrom-Json

$envText = @"
# Auto-generated — DO NOT COMMIT
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_RPC_URL_FALLBACK=
X_MARKET_PACKAGE_ID=$($deploy.packageId)
PROPHET_REGISTRY_ID=$($deploy.prophet.registryId)
ORACLE_CONFIG_ID=$($deploy.oracle.oracleConfigId)
SEED_DEPLOY_JSON=../../deploy/testnet-v2.json
INDEXER_DATABASE_URL=postgresql://xmarket:xmarket@localhost:5432/xmarket_indexer
INDEXER_API_PORT=8800
INDEXER_EVENT_POLL_MS=15000
INDEXER_SNAPSHOT_POLL_MS=60000
INDEXER_STATS_POLL_MS=120000
INDEXER_CORS_ORIGIN=http://localhost:3000
HOST=0.0.0.0
"@

$path = "services/indexer/.env.local"
Set-Content -Path $path -Value $envText.Trim() -Encoding UTF8
Write-Host "Wrote $path"

$appLocal = "app/.env.local"
if (Test-Path $appLocal) {
  $appText = Get-Content $appLocal -Raw
  if ($appText -notmatch "NEXT_PUBLIC_INDEXER_URL") {
    $appText += "`nNEXT_PUBLIC_INDEXER_URL=http://localhost:8800`n"
  } else {
    $appText = $appText -replace "NEXT_PUBLIC_INDEXER_URL=.*", "NEXT_PUBLIC_INDEXER_URL=http://localhost:8800"
  }
  Set-Content -Path $appLocal -Value $appText.TrimEnd() -Encoding UTF8
  Write-Host "Updated $appLocal"
}

Write-Host "Next: docker compose -f docker-compose.indexer.yml up -d postgres"
Write-Host "       .\scripts\start-indexer.ps1"
