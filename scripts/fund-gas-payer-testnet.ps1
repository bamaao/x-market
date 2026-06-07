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
