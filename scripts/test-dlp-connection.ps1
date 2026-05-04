# DLP Monitor Script - Captures Sidecar and Electron logs
$ErrorActionPreference = "Continue"

$DEV_PORT = 5173
$sidecarLog = "$env:TEMP\dlp_sidecar.log"
$electronLog = "$env:TEMP\dlp_electron.log"

# Clear old logs
Remove-Item $sidecarLog -ErrorAction SilentlyContinue
Remove-Item $electronLog -ErrorAction SilentlyContinue

Write-Host "=== DLP Log Monitor ===" -ForegroundColor Cyan
Write-Host "Sidecar log: $sidecarLog"
Write-Host "Electron log: $electronLog"
Write-Host ""

# Start Sidecar with file logging
Write-Host "[1/3] Starting Sidecar..." -ForegroundColor Yellow
$sidecarProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\sidecar\SecurityMonitor\bin_v4'; dotnet SecurityMonitor.dll 2>&1 | Tee-Object -FilePath '$sidecarLog'" -WindowStyle Normal -PassThru

Start-Sleep -Seconds 2

# Start Vite dev server
Write-Host "[2/3] Starting Vite dev server..." -ForegroundColor Yellow
$viteProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\frontend'; npx vite 2>&1 | Tee-Object -FilePath '$env:TEMP\dlp_vite.log'" -WindowStyle Normal -PassThru

# Wait for Vite to be ready
Write-Host "Waiting for Vite to start..." -ForegroundColor Gray
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$DEV_PORT" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response) {
            Write-Host "Vite is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $waited++
}

# Start Electron with file logging
Write-Host "[3/3] Starting Electron..." -ForegroundColor Yellow
$electronProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\frontend'; npx electron . 2>&1 | Tee-Object -FilePath '$electronLog'" -WindowStyle Normal -PassThru

Write-Host ""
Write-Host "=== All processes started ===" -ForegroundColor Green
Write-Host "Monitor logs with: Get-Content $electronLog -Wait -Tail 50"
Write-Host "Press Ctrl+C to stop all processes"
Write-Host ""

# Wait a bit then show initial logs
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=== SIDECAR LOG ===" -ForegroundColor Cyan
if (Test-Path $sidecarLog) {
    Get-Content $sidecarLog -Tail 30
} else {
    Write-Host "No sidecar log yet..."
}

Write-Host ""
Write-Host "=== ELECTRON LOG ===" -ForegroundColor Cyan
if (Test-Path $electronLog) {
    Get-Content $electronLog -Tail 30
} else {
    Write-Host "No electron log yet..."
}

Write-Host ""
Write-Host "Monitoring for 60 seconds... Press Ctrl+C to stop" -ForegroundColor Yellow

# Monitor for 60 seconds
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5

    # Check for connection issues
    if (Test-Path $electronLog) {
        $lastLines = Get-Content $electronLog -Tail 20 -ErrorAction SilentlyContinue
        if ($lastLines -match "Connection closed") {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] WARNING: Connection closed detected!" -ForegroundColor Red
        }
        if ($lastLines -match "Successfully connected to Sidecar") {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connected!" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "=== Final Logs ===" -ForegroundColor Cyan

Write-Host ""
Write-Host "--- SIDECAR LOG ---" -ForegroundColor Yellow
if (Test-Path $sidecarLog) {
    Get-Content $sidecarLog
}

Write-Host ""
Write-Host "--- ELECTRON LOG ---" -ForegroundColor Yellow
if (Test-Path $electronLog) {
    Get-Content $electronLog
}

Write-Host ""
Write-Host "Stopping all processes..." -ForegroundColor Yellow

# Stop all processes
$electronProcess | Stop-Process -Force -ErrorAction SilentlyContinue
$viteProcess | Stop-Process -Force -ErrorAction SilentlyContinue
$sidecarProcess | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "electron","SecurityMonitor" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Where-Object {
    try { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine -like "*SecurityMonitor*" } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Done!" -ForegroundColor Green
