# Copyright (c) 2026 zouyc zouyccq@gmail.com.
# One-shot: deposit initial USDC into seed pools from deploy/testnet-v2.json
# (create_*_pool_with_feed leaves Vault=0; p0-drills deposits before buy)
param(
  [int]$AmountUsdc = 50
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $root "app")
Write-Host "Seeding seed pools with $AmountUsdc USDC each..."
npx tsx scripts/seed-pool-liquidity.ts $AmountUsdc
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Refresh market page to see Vault balance."
