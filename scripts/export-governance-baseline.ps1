# 导出当前链上 + 环境治理参数快照，与 docs/governance-params-baseline.json 对照
param(
  [string]$DeployJson = "deploy/testnet-v2.json",
  [string]$BaselineJson = "docs/governance-params-baseline.json",
  [string]$OutJson = "docs/governance-params-snapshot.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$deploy = Get-Content (Join-Path $root $DeployJson) -Raw | ConvertFrom-Json
$baseline = Get-Content (Join-Path $root $BaselineJson) -Raw | ConvertFrom-Json

function Get-PoolFields($poolId) {
  $obj = sui client object $poolId --json | ConvertFrom-Json
  if ($obj.content.fields) { return $obj.content.fields }
  if ($obj.content -and $obj.content.fee_bps -ne $null) { return $obj.content }
  if ($obj.data.content.fields) { return $obj.data.content.fields }
  throw "Cannot parse pool $poolId"
}

$poolIds = @(
  $deploy.seedMarkets.poisson_goals.poolId,
  $deploy.seedMarkets.dirichlet_wdl.poolId,
  $deploy.seedMarkets.normal_cpi.poolId
)

$pools = @{}
foreach ($id in $poolIds) {
  $f = Get-PoolFields $id
  $pools[$id] = @{
    fee_bps = [int]$f.fee_bps
    fee_multiplier_bps = [int]$f.fee_multiplier_bps
    deposit_cutoff_bps = [int]$f.deposit_cutoff_bps
    resolution_window_ts = [string]$f.resolution_window_ts
    sigma_virtual_tenths = [int]$f.sigma_virtual_tenths
    concentration_virtual = if ($f.concentration_virtual) { [int]$f.concentration_virtual } else { 0 }
    authority = [string]$f.authority
  }
}

$oracleId = [string]$deploy.oracle.oracleConfigId
$oracleJson = sui client object $oracleId --json | ConvertFrom-Json
$minBond = [string]$oracleJson.content.minimum_bond
$liveness = [string]$oracleJson.content.default_liveness_secs
if (-not $minBond -or -not $liveness) {
  throw "OracleConfig $oracleId missing minimum_bond/liveness (got bond=$minBond live=$liveness)"
}

$keeperEnv = @{}
$keeperPath = "services/lp-guard-keeper/.env.local"
if (Test-Path $keeperPath) {
  Get-Content $keeperPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $Matches[1].Trim()
      $v = $Matches[2].Trim()
      if ($k -notmatch 'SECRET|PRIVATE|KEY') { $keeperEnv[$k] = $v }
    }
  }
}

$gasEnv = @{}
$gasPath = "services/gas-station/.env.local"
if (Test-Path $gasPath) {
  Get-Content $gasPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $Matches[1].Trim()
      $v = $Matches[2].Trim()
      if ($k -notmatch 'SECRET|PRIVATE|KEY') { $gasEnv[$k] = $v }
    }
  }
}

$snapshot = [ordered]@{
  exportedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  gitCommit = (git rev-parse HEAD 2>$null)
  packageId = $deploy.packageId
  oracleConfigId = $deploy.oracle.oracleConfigId
  oracleOnChain = @{
    minimum_bond = $minBond
    default_liveness_secs = $liveness
  }
  seedPools = $pools
  keeperEnv = $keeperEnv
  gasStationEnv = $gasEnv
  moveConstants = @{
    slash_timelock_secs = 1800
    slash_max_single_bps = 3000
    slash_max_cycle_bps = 5000
    zk_challenge_window_secs = 3600
    prophet_protocol_fee_bps = 500
    prophet_min_audited = 3
    prophet_min_score_bps = 4000
    prophet_unlock_cutoff_secs = 300
  }
}

$snapshot | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root $OutJson) -Encoding UTF8
Write-Host "Wrote $OutJson"
Write-Host "Baseline: $BaselineJson"
Write-Host "Verify: .\scripts\verify-governance-params.ps1"
