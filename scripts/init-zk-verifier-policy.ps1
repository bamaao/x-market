# 初始化 ZK 验证委员会策略（zk_coprocessor::init_verifier_policy）
param(
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$GlobalConfig = $env:X_MARKET_GLOBAL_CONFIG,
  [string]$AdminCap = $env:X_MARKET_ADMIN_CAP,
  [string[]]$VerifierSigners = @(),
  [int]$Threshold = 1,
  [string]$DeployJson = "deploy/testnet-v2.json"
)

function Get-CreatedObjectId {
  param([string]$JsonText, [string]$TypeSuffix)
  $tx = $JsonText | ConvertFrom-Json
  foreach ($ch in $tx.objectChanges) {
    if ($ch.type -eq "created" -and $ch.objectType -like "*$TypeSuffix*") {
      return $ch.objectId
    }
  }
  return $null
}

if (-not $PackageId) {
  if (Test-Path $DeployJson) {
    $deploy = Get-Content $DeployJson -Raw | ConvertFrom-Json
    $PackageId = $deploy.packageId
    if (-not $GlobalConfig) { $GlobalConfig = $deploy.globalConfig }
    if (-not $AdminCap) { $AdminCap = $deploy.adminCap }
  }
}

if (-not $PackageId -or -not $GlobalConfig -or -not $AdminCap) {
  Write-Error "需要 PackageId、GlobalConfig、AdminCap"
  exit 1
}

if ($VerifierSigners.Count -eq 0) {
  $VerifierSigners = @((sui client active-address).Trim())
}

$signerJson = ($VerifierSigners | ForEach-Object { "`"$_`"" }) -join ","
$signerArg = "[$signerJson]"

Write-Host "Package:   $PackageId"
Write-Host "Signers:   $signerArg"
Write-Host "Threshold: $Threshold"

Write-Host "`ninit_verifier_policy..."
$out = sui client call --package $PackageId --module zk_coprocessor --function init_verifier_policy `
  --args $GlobalConfig $AdminCap "vector<address>:$signerArg" $Threshold --gas-budget 100000000 --json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$policyId = Get-CreatedObjectId -JsonText $out -TypeSuffix "zk_coprocessor::ZkVerifierPolicy"
Write-Host "ZkVerifierPolicy: $policyId"
Write-Host ""
Write-Host "Add to services/brevis-zk-prover/.env.local:"
Write-Host "ZK_VERIFIER_POLICY_ID=$policyId"

$appLocal = "app/.env.local"
if (Test-Path $appLocal) {
  $lines = Get-Content $appLocal
  $updated = $false
  $newLines = foreach ($line in $lines) {
    if ($line -match "^NEXT_PUBLIC_ZK_VERIFIER_POLICY_ID=") {
      $updated = $true
      "NEXT_PUBLIC_ZK_VERIFIER_POLICY_ID=$policyId"
    } else {
      $line
    }
  }
  if (-not $updated) {
    $newLines += "NEXT_PUBLIC_ZK_VERIFIER_POLICY_ID=$policyId"
  }
  Set-Content -Path $appLocal -Value ($newLines -join "`n") -Encoding UTF8
  Write-Host "Updated $appLocal"
}
