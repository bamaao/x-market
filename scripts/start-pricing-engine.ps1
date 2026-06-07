# 启动 Pricing Engine（P3，默认 :8801）
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$runDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (-not $SkipInstall) {
  Push-Location pricing-engine
  npm install --silent 2>&1 | Out-Null
  Pop-Location
}

$pidFile = Join-Path $runDir "pricing-engine.pid"
$logFile = Join-Path $runDir "pricing-engine.log"
if (Test-Path $pidFile) {
  $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  $existing = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Pricing engine already running (pid $savedPid)"
    exit 0
  }
}

$cmd = "npm start *> `"$logFile`""
$proc = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-Command", $cmd) `
  -WorkingDirectory (Join-Path $root "pricing-engine") -PassThru -WindowStyle Hidden
$proc.Id | Set-Content $pidFile
Write-Host "Started pricing-engine pid=$($proc.Id) log=$logFile"

Start-Sleep -Seconds 3
try {
  $r = Invoke-RestMethod -Uri "http://localhost:8801/health" -TimeoutSec 10
  if ($r.ok) {
    Write-Host "[OK] pricing-engine http://localhost:8801/health" -ForegroundColor Green
  }
} catch {
  Write-Host "[WARN] pricing-engine health check failed — see $logFile" -ForegroundColor Yellow
}
