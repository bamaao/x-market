# 创建 Opening Auction 池（Poisson 或 Dirichlet）
param(
  [ValidateSet("poisson", "dirichlet")]
  [string]$Kind = "poisson",
  [string]$PackageId = $env:X_MARKET_PACKAGE_ID,
  [string]$ClockId = "0x6",
  [int]$AuctionHours = 24,
  [int]$MaturityDays = 30,
  [int]$FeeBps = 30
)

$now = [int][double]::Parse((Get-Date -UFormat %s))
$auctionEnd = $now + ($AuctionHours * 3600)
$maturity = $now + ($MaturityDays * 86400)

if (-not $PackageId) {
  Write-Error "请通过 -PackageId 或环境变量 X_MARKET_PACKAGE_ID 指定包 ID"
  exit 1
}

Write-Host "Package: $PackageId"
Write-Host "Kind: $Kind"
Write-Host "AuctionEnd: $auctionEnd"
Write-Host "Maturity: $maturity"

if ($Kind -eq "poisson") {
  sui client call --package $PackageId --module pool --function start_poisson_auction `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
} else {
  sui client call --package $PackageId --module pool --function start_dirichlet_auction `
    --args $auctionEnd $maturity $FeeBps $ClockId --gas-budget 100000000
}
