# Copyright (c) 2026 zouyc zouyccq@gmail.com.
# All rights reserved.
#
# Licensed under the Business Source License 1.1 (BSL 1.1).
# You may not use this file except in compliance with the License.
#
# Change Date: 2031-01-01
# On the Change Date, or the fourth anniversary of the first publicly available
# distribution of the code under the BSL, whichever comes first, the code
# automatically becomes available under the Apache License 2.0.

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
  Write-Error "发送方没有 USDC，请从 Circle 测试网水龙头领取或请他人转账"
  exit 1
}
$id = $usdcCoin.data.objectId
Write-Host "Transfer USDC coin $id -> $Recipient"
sui client transfer --to $Recipient --object-id $id --gas-budget 25000000
