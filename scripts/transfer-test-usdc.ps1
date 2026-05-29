# 向测试地址转账整枚 USDC Coin（从当前 active-address）
# 部分金额请在前端合并后 split，或使用 sui client ptb
param(
  [Parameter(Mandatory = $true)][string]$Recipient,
  [string]$CoinObjectId = ""
)

if ($CoinObjectId) {
  sui client transfer --to $Recipient --object-id $CoinObjectId --gas-budget 25000000
  exit $LASTEXITCODE
}

$sender = (sui client active-address).Trim()
$coinList = sui client objects $sender --json | ConvertFrom-Json
$usdcCoin = $coinList.data | Where-Object { $_.data.type -like "*usdc::USDC*" } | Select-Object -First 1
if (-not $usdcCoin) {
  Write-Error "发送方没有 USDC，请先运行 .\scripts\mint-test-usdc.ps1"
  exit 1
}
$id = $usdcCoin.data.objectId
Write-Host "Transfer USDC coin $id -> $Recipient"
sui client transfer --to $Recipient --object-id $id --gas-budget 25000000
