# Simple DLP Test - Writes logs to files
$ErrorActionPreference = "Continue"

$DEV_PORT = 5173
$sidecarLog = "$env:TEMP\dlp_sidecar_new.log"
$electronLog = "$env:TEMP\dlp_electron_new.log"
$viteLog = "$env:TEMP\dlp_vite_new.log"

Remove-Item $sidecarLog -ErrorAction SilentlyContinue
Remove-Item $electronLog -ErrorAction SilentlyContinue
Remove-Item $viteLog -ErrorAction SilentlyContinue

Write-Host "Starting Vite dev server on port $DEV_PORT..."
$npmProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\frontend'; `$env:VITE_DEV_PORT='$DEV_PORT'; npx vite 2>&1 | Tee-Object -FilePath '$viteLog'" -WindowStyle Normal -PassThru

# Wait for Vite to be ready
Write-Host "Waiting for Vite..."
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

if ($waited -ge $maxWait) {
    Write-Host "Vite failed to start!" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Sidecar v4..."
$sidecarProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\sidecar\SecurityMonitor\bin_v4'; dotnet SecurityMonitor.dll 2>&1 | Tee-Object -FilePath '$sidecarLog'" -WindowStyle Normal -PassThru

Start-Sleep -Seconds 3

Write-Host "Starting Electron..."
$electronProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\frontend'; `$env:VITE_DEV_PORT='$DEV_PORT'; npx electron . 2>&1 | Tee-Object -FilePath '$electronLog'" -WindowStyle Normal -PassThru

Write-Host "Waiting 45 seconds..."
Start-Sleep -Seconds 45

Write-Host ""
Write-Host "=== VITE LOG ===" -ForegroundColor Yellow
if (Test-Path $viteLog) {
    Get-Content $viteLog | Select-Object -Last 20
}

Write-Host ""
Write-Host "=== SIDECAR LOG ===" -ForegroundColor Cyan
if (Test-Path $sidecarLog) {
    Get-Content $sidecarLog
} else {
    Write-Host "No sidecar log"
}

Write-Host ""
Write-Host "=== ELECTRON LOG ===" -ForegroundColor Cyan
if (Test-Path $electronLog) {
    Get-Content $electronLog | Select-Object -Last 40
} else {
    Write-Host "No electron log"
}

Write-Host ""
Write-Host "Done. Check logs above." -ForegroundColor Green
