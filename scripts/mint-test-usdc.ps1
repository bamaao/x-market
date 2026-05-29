# 铸造测试 USDC（通过 x_market_faucet 包）
param(
  [string]$FaucetPackage = "0x70bb4f8ed11991f79dbafef255ad1881d169bb1e337b69b129d997dd4216ebf0",
  [string]$TreasuryCap = "0x665f9aa32bbb18a65749b7fee38be8499d87fe0ddcdb8e8bbf738f4129975eaf",
  [uint64]$Amount = 1000000000000
)

# 默认 1_000_000 USDC（6 decimals）
sui client call --package $FaucetPackage --module faucet --function mint_to_sender `
  --args $TreasuryCap $Amount --gas-budget 30000000

Write-Host "Minted $Amount base units to active address."
