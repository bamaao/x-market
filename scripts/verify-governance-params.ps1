# P0.6：校验链上/环境与治理基线 JSON 一致
param(
  [string]$DeployJson = "deploy/testnet-v2.json",
  [string]$BaselineJson = "docs/governance-params-baseline.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

& "$PSScriptRoot\export-governance-baseline.ps1" -DeployJson $DeployJson -OutJson "docs/governance-params-snapshot.json"
$snapshot = Get-Content "docs/governance-params-snapshot.json" -Raw | ConvertFrom-Json
$baseline = Get-Content (Join-Path $root $BaselineJson) -Raw | ConvertFrom-Json

$failed = @()
$passed = @()

function Assert-Eq($name, $actual, $expected) {
  $a = "$actual"
  $e = "$expected"
  if ($a -eq $e) {
    $script:passed += $name
    Write-Host "[OK] $name = $a" -ForegroundColor Green
  } else {
    $script:failed += $name
    Write-Host "[FAIL] $name expected=$e actual=$a" -ForegroundColor Red
  }
}

Write-Host "=== P0.6 Governance Params Verify ===" -ForegroundColor Cyan

Assert-Eq "packageId" $snapshot.packageId $baseline.packageId
Assert-Eq "oracle.minimum_bond" $snapshot.oracleOnChain.minimum_bond $baseline.macroOracle.minimum_bond_usdc_base_units
Assert-Eq "oracle.liveness" $snapshot.oracleOnChain.default_liveness_secs $baseline.macroOracle.default_liveness_secs

Assert-Eq "slash.timelock" $snapshot.moveConstants.slash_timelock_secs $baseline.slash.timelock_secs
Assert-Eq "slash.max_single_bps" $snapshot.moveConstants.slash_max_single_bps $baseline.slash.max_single_bps
Assert-Eq "slash.max_cycle_bps" $snapshot.moveConstants.slash_max_cycle_bps $baseline.slash.max_cycle_bps
Assert-Eq "zk.challenge_window" $snapshot.moveConstants.zk_challenge_window_secs $baseline.zkCoprocessor.challenge_window_secs
Assert-Eq "prophet.protocol_fee_bps" $snapshot.moveConstants.prophet_protocol_fee_bps $baseline.suiProphet.protocol_fee_bps
Assert-Eq "prophet.min_audited" $snapshot.moveConstants.prophet_min_audited $baseline.suiProphet.min_audited_for_paid
Assert-Eq "prophet.min_score_bps" $snapshot.moveConstants.prophet_min_score_bps $baseline.suiProphet.min_score_bps_for_paid

if ($snapshot.keeperEnv.LP_GUARD_MAX_EFFECTIVE_FEE_BPS) {
  Assert-Eq "keeper.max_effective_fee" $snapshot.keeperEnv.LP_GUARD_MAX_EFFECTIVE_FEE_BPS $baseline.lpGuard.keeperEnv.LP_GUARD_MAX_EFFECTIVE_FEE_BPS
  Assert-Eq "keeper.max_fee_mult" $snapshot.keeperEnv.LP_GUARD_MAX_FEE_MULTIPLIER_BPS $baseline.lpGuard.keeperEnv.LP_GUARD_MAX_FEE_MULTIPLIER_BPS
  Assert-Eq "keeper.decay" $snapshot.keeperEnv.LP_GUARD_DECAY_FACTOR $baseline.lpGuard.keeperEnv.LP_GUARD_DECAY_FACTOR
} else {
  Write-Host "[SKIP] keeper env — no .env.local" -ForegroundColor Yellow
}

if ($snapshot.gasStationEnv.SPONSOR_RATE_LIMIT_PER_MIN) {
  Assert-Eq "gas.rate_limit" $snapshot.gasStationEnv.SPONSOR_RATE_LIMIT_PER_MIN $baseline.gasStation.sponsor_rate_limit_per_min
  Assert-Eq "gas.min_balance" $snapshot.gasStationEnv.GAS_MIN_BALANCE_MIST $baseline.gasStation.gas_min_balance_mist
} else {
  Write-Host "[SKIP] gas station env — no .env.local" -ForegroundColor Yellow
}

# Testnet 种子池 fee=30 为联调值；主网种子默认 fee_bps=200（见 baseline.mainnetSeedPoolDefaults）
$firstPool = ($snapshot.seedPools.PSObject.Properties | Select-Object -First 1).Value
if ($firstPool) {
  Assert-Eq "testnet.seed.fee_bps" $firstPool.fee_bps $baseline.lpGuard.testnetSeedPoolActual.fee_bps
}

Write-Host ""
Write-Host "Passed: $($passed.Count)  Failed: $($failed.Count)"
if ($failed.Count -gt 0) { exit 1 }

Write-Host ""
Write-Host "Baseline matches chain/env. Remaining P0.6 manual: dual sign-off in docs/governance-params-signoff.md" -ForegroundColor Green
exit 0
