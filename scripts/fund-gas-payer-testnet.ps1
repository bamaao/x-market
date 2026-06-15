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

# P1.7 Testnet：为当前活跃地址申请 faucet SUI
param(
  [string]$Address = ""
)

$ErrorActionPreference = "Stop"
if (-not $Address) {
  $Address = (sui client active-address).Trim()
}
Write-Host "Requesting testnet SUI for $Address ..."
sui client faucet --address $Address
Write-Host "Done. Run .\scripts\check-gas-balances.ps1 to verify."
