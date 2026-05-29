# 配置 Phase 2 LP Guard 参数
param(
  [Parameter(Mandatory = $true)][string]$PoolId,
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [uint16]$FeeMultiplierBps = 0,
  [uint32]$SigmaVirtualTenths = 0,
  [uint32]$ConcentrationVirtual = 0,
  [uint16]$DepositCutoffBps = 0,
  [uint64]$ResolutionWindowTs = 0
)

if (-not $PackageId) {
  Write-Error "请通过 -PackageId 或环境变量 X_MARKET_PACKAGE_ID 指定包 ID"
  exit 1
}

sui client call --package $PackageId --module pool --function set_lp_guard_params `
  --args $PoolId $FeeMultiplierBps $SigmaVirtualTenths $ConcentrationVirtual $DepositCutoffBps $ResolutionWindowTs `
  --gas-budget 50000000
