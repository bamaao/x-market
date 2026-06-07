# 启动 Testnet 链下服务（P0 + P1）
param(
  [switch]$SkipInstall,
  [switch]$P0Only,
  [switch]$IncludeP4
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$services = @("gas-station", "lp-guard-keeper")
if (-not $P0Only) {
  $services += @("chain-monitor", "oracle-relayer", "walrus-relay")
}
if ($IncludeP4) {
  $services += @("prophet-audit-keeper")
}

foreach ($svc in $services) {
  $envFile = "services/$svc/.env.local"
  if (-not (Test-Path $envFile)) {
    throw "Missing $envFile — run .\scripts\bootstrap-services-env.ps1 first"
  }
}

if (-not $SkipInstall) {
  foreach ($svc in $services) {
    Write-Host "npm install: services/$svc"
    Push-Location "services/$svc"
    npm install --silent 2>&1 | Out-Null
    Pop-Location
  }
}

function Start-ServiceJob($name, $workDir, $logFile, $pidFile) {
  if (Test-Path $pidFile) {
    $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    $existing = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Host "$name already running (pid $savedPid)"
      return
    }
  }

  $cmd = "npm start *> `"$logFile`""
  $proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-Command", $cmd) `
    -WorkingDirectory $workDir -PassThru -WindowStyle Hidden
  $proc.Id | Set-Content $pidFile
  Write-Host "Started $name pid=$($proc.Id) log=$logFile"
}

foreach ($svc in $services) {
  Start-ServiceJob $svc (Join-Path $root "services/$svc") `
    (Join-Path $runDir "$svc.log") (Join-Path $runDir "$svc.pid")
}

Start-Sleep -Seconds 4
& "$PSScriptRoot\verify-services-health.ps1" -IncludeP1:(-not $P0Only)
