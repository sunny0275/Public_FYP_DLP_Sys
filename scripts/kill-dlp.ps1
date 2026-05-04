# Kill all DLP-related processes to clean up for a fresh start
# Order: Electron -> SecurityMonitor -> Port 3000 -> Node processes

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "Killing all DLP-related processes..." -ForegroundColor Yellow
Write-Host "============================================"

# 1. Kill Electron processes
$electronProcs = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcs) {
    Write-Host "[Electron] Killing $($electronProcs.Count) process(es)..."
    $electronProcs | Stop-Process -Force -ErrorAction SilentlyContinue
}

# 2. Kill SecurityMonitor (sidecar)
$sidecarProcs = Get-Process -Name "SecurityMonitor" -ErrorAction SilentlyContinue
if ($sidecarProcs) {
    Write-Host "[Sidecar] Killing $($sidecarProcs.Count) process(es)..."
    $sidecarProcs | Stop-Process -Force -ErrorAction SilentlyContinue
}

# 3. Release port 3000 (Vite dev server)
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($port3000) {
    $portProcs = Get-Process -Id $port3000 -ErrorAction SilentlyContinue
    if ($portProcs) {
        Write-Host "[Port 3000] Killing $($portProcs.Count) process(es)..."
        $portProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    }
}

# 4. Kill any Node processes from frontend/backend (optional cleanup)
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*DLP*" -or
    $_.MainWindowTitle -like "*vite*" -or
    $_.MainWindowTitle -like "*hardhat*" -or
    $_.Path -like "*FYP*"
}
if ($nodeProcs) {
    Write-Host "[Node] Killing $($nodeProcs.Count) process(es)..."
    $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
}

# 5. Give processes time to terminate
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "All DLP processes killed." -ForegroundColor Green
Write-Host "============================================"
