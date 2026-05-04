# DLP Monitor Script - Uses bin directory (has full runtime)
$ErrorActionPreference = "Continue"

$sidecarLog = "$env:TEMP\dlp_sidecar_test.log"
$electronLog = "$env:TEMP\dlp_electron_test.log"

# Clear old logs
Remove-Item $sidecarLog -ErrorAction SilentlyContinue
Remove-Item $electronLog -ErrorAction SilentlyContinue

Write-Host "=== DLP Monitor (1 minute) ===" -ForegroundColor Cyan
Write-Host "Using: bin directory (not bin_new)" -ForegroundColor Yellow
Write-Host ""

# Check for existing processes
Write-Host "[1/4] Checking for existing processes..." -ForegroundColor Yellow
Get-Process -Name "electron","dotnet" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Sidecar from bin directory
Write-Host "[2/4] Starting Sidecar from bin directory..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\sidecar\SecurityMonitor\bin'; dotnet SecurityMonitor.dll 2>&1 | Tee-Object -FilePath '$sidecarLog'" -WindowStyle Normal
Start-Sleep -Seconds 5

# Start Vite dev server
Write-Host "[3/4] Starting Vite dev server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Test\FYP\frontend'; `$env:VITE_DEV_PORT='5173'; npm run dev 2>&1 | Tee-Object -FilePath '$electronLog'" -WindowStyle Normal

Write-Host "Waiting for Vite to start..." -ForegroundColor Gray
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response) {
            Write-Host "Vite is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
    $waited++
}

Write-Host ""
Write-Host "=== MONITORING FOR 60 SECONDS ===" -ForegroundColor Cyan
Write-Host ""

# Monitoring variables
$connectionState = "UNKNOWN"
$lastConnectionTime = $null
$disconnectCount = 0

# Monitor for 60 seconds
for ($i = 0; $i -lt 12; $i++) {
    $elapsed = ($i + 1) * 5
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Status check ($elapsed/60s)..." -ForegroundColor Gray
    
    if (Test-Path $electronLog) {
        $content = Get-Content $electronLog -Tail 50 -ErrorAction SilentlyContinue | Out-String
        
        # Check connection status
        if ($content -match "Successfully connected to Sidecar") {
            if ($connectionState -ne "CONNECTED") {
                $connectionState = "CONNECTED"
                $lastConnectionTime = Get-Date
                Write-Host "  [STATUS] CONNECTED!" -ForegroundColor Green
            }
        }
        
        if ($content -match "\[DLP Pipe\] Connection closed") {
            $disconnectCount++
            Write-Host "  [EVENT] Connection closed (count: $disconnectCount)" -ForegroundColor Yellow
        }
        
        if ($content -match "Connection failed|Scheduling reconnect|retrying in \d+ms") {
            if ($content -match "Successfully connected to Sidecar") {
                # Already reconnected
            } else {
                Write-Host "  [EVENT] Reconnecting..." -ForegroundColor Yellow
            }
        }
        
        # Show connection events
        $pipeEvents = @()
        if ($content -match "Connected to Sidecar") { $pipeEvents += "CONNECTED" }
        if ($content -match "Authentication successful") { $pipeEvents += "AUTH_OK" }
        if ($content -match "Connection closed") { $pipeEvents += "CLOSED" }
        if ($content -match "Connection failed") { $pipeEvents += "FAILED" }
        if ($pipeEvents.Count -gt 0) {
            Write-Host "    Events: $($pipeEvents -join ', ')" -ForegroundColor DarkGray
        }
    }
    
    Write-Host ""
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Host "=== FINAL REPORT ===" -ForegroundColor Cyan
Write-Host ""

# Check final state
if (Test-Path $electronLog) {
    $finalContent = Get-Content $electronLog -ErrorAction SilentlyContinue | Out-String
    
    Write-Host "Connection Statistics:" -ForegroundColor Yellow
    Write-Host "  - Disconnection events: $disconnectCount"
    
    if ($finalContent -match "Successfully connected to Sidecar") {
        $connectedMatch = [regex]::Match($finalContent, "Successfully connected to Sidecar")
        Write-Host "  - Final state: CONNECTED" -ForegroundColor Green
        
        # Check if still connected
        $lastLines = Get-Content $electronLog -Tail 20 -ErrorAction SilentlyContinue | Out-String
        if ($lastLines -match "Connection closed") {
            Write-Host "  - Warning: Connection was closed during test" -ForegroundColor Red
        } else {
            Write-Host "  - Status: STABLE (no disconnections in last 20 lines)" -ForegroundColor Green
        }
    } else {
        Write-Host "  - Final state: NOT CONNECTED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== SIDECAR LOG ===" -ForegroundColor Cyan
if (Test-Path $sidecarLog) {
    Get-Content $sidecarLog | Select-Object -Last 20
} else {
    Write-Host "No sidecar log found" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== ELECTRON LOG (Last 30 lines) ===" -ForegroundColor Cyan
if (Test-Path $electronLog) {
    Get-Content $electronLog | Select-Object -Last 30
}

Write-Host ""
Write-Host "Stopping processes..." -ForegroundColor Yellow
Get-Process -Name "electron","dotnet" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Done!" -ForegroundColor Green
