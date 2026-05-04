# =============================================================================
# Blockchain Monitor & Auto-Start Script (PowerShell)
# Ensures local Hardhat blockchain node is running before backend starts
# Implements: 30s health check → auto-restart → 5min fail-safe shutdown
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "monitor", "check", "stop")]
    [string]$Command = "monitor",

    [Parameter(Position=1)]
    [string]$RpcUrl = "http://localhost:8545"
)

$BlockChainCheckInterval = 30    # Check every 30 seconds
$BlockChainStartTimeout = 60     # Wait up to 60s for Hardhat to start
$MaxConsecutiveFailures = 10    # Stop system after 10 failures (5 minutes)
$LogFile = "blockchain.log"
$PidFile = ".blockchain.pid"
$FailureCount = 0                # Track consecutive failures

function Write-LogInfo {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-LogWarn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-LogError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-BlockChainConnection {
    try {
        $body = @{
            jsonrpc = "2.0"
            method = "eth_chainId"
            params = @()
            id = 1
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri $RpcUrl -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
        return $null -ne $response.result
    }
    catch {
        return $false
    }
}

function Start-BlockChainNode {
    Write-LogInfo "Starting local Hardhat blockchain node..."

    # Kill any existing hardhat processes
    $existingPids = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*hardhat*" }
    foreach ($proc in $existingPids) {
        Write-LogInfo "Killing existing Hardhat process (PID: $($proc.Id))"
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2

    # Start new Hardhat node
    $processInfo = Start-Process -FilePath "npx" -ArgumentList "hardhat", "node", "--hostname", "0.0.0.0" -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError "blockchain_error.log"

    $processInfo.Id | Out-File -FilePath $PidFile -Encoding utf8
    Write-LogInfo "Hardhat started with PID: $($processInfo.Id)"

    # Wait for it to be ready
    Write-LogInfo "Waiting for blockchain to be ready..."
    $elapsed = 0

    while ($elapsed -lt $BlockChainStartTimeout) {
        if (Test-BlockChainConnection) {
            Write-LogInfo "Blockchain is ready!"
            return $true
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Host -NoNewline "."
    }

    Write-LogError "Blockchain failed to start within $BlockChainStartTimeout seconds"
    return $false
}

function Stop-BlockChainNode {
    if (Test-Path $PidFile) {
        $pid = Get-Content $PidFile -Raw
        if ($pid -match '\d+') {
            $processId = [int]$Matches[0]
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-LogInfo "Stopping blockchain (PID: $processId)"
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
            }
            catch { }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    # Also kill by process name
    $hardhatProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*hardhat*" }
    foreach ($proc in $hardhatProcesses) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Start-MonitorLoop {
    Write-LogInfo "Starting blockchain health monitor..."
    Write-LogInfo "Check interval: $BlockChainCheckInterval seconds"
    Write-LogInfo "Max consecutive failures: $MaxConsecutiveFailures (will stop system after 5 minutes)"
    Write-LogInfo "Press Ctrl+C to stop monitoring`n"

    $script:FailureCount = 0

    while ($true) {
        if (-not (Test-BlockChainConnection)) {
            $script:FailureCount++
            $elapsedMinutes = [math]::Round($script:FailureCount * $BlockChainCheckInterval / 60, 1)
            Write-LogWarn "Blockchain is not responsive! (Failure $script:FailureCount / $MaxConsecutiveFailures, elapsed: ${elapsedMinutes}min)"

            # Check if we've exceeded the maximum consecutive failures (5 minutes of outages)
            if ($script:FailureCount -ge $MaxConsecutiveFailures) {
                Write-LogError "CRITICAL: Blockchain node has been unavailable for $elapsedMinutes minutes ($script:FailureCount restart attempts)."
                Write-LogError "CRITICAL: Stopping system to prevent data integrity issues."
                Write-LogError "CRITICAL: Manual intervention required. Please check:"
                Write-LogError "  - blockchain.log for errors"
                Write-LogError "  - Port 8545 is not blocked"
                Write-LogError "  - Sufficient system resources (CPU/memory/disk)"
                Write-LogError "  - Node.js/npm are properly installed"

                # Stop blockchain process cleanly
                Stop-BlockChainNode

                # Exit with error code to signal system failure
                Write-Host "`n[SYSTEM] Exiting with code 1 - blockchain health check failed" -ForegroundColor Red
                exit 1
            }

            Write-LogWarn "Attempting to restart blockchain..."
            Stop-BlockChainNode
            Start-Sleep -Seconds 2
            $started = Start-BlockChainNode

            if ($started) {
                $script:FailureCount = 0
                Write-LogInfo "Blockchain is now healthy!"
            }
            else {
                Write-LogWarn "Restart failed, will retry in next cycle..."
            }
        }
        else {
            if ($script:FailureCount -gt 0) {
                Write-LogInfo "Blockchain is now healthy! (Reset failure counter)"
                $script:FailureCount = 0
            }
        }

        Start-Sleep -Seconds $BlockChainCheckInterval
    }
}

# Main execution
switch ($Command) {
    "start" {
        if (Test-BlockChainConnection) {
            Write-LogInfo "Blockchain is already running at $RpcUrl"
        }
        else {
            Start-BlockChainNode
        }
    }
    "monitor" {
        Start-MonitorLoop
    }
    "check" {
        if (Test-BlockChainConnection) {
            Write-LogInfo "Blockchain is healthy at $RpcUrl"
            exit 0
        }
        else {
            Write-LogError "Blockchain is NOT responding at $RpcUrl"
            exit 1
        }
    }
    "stop" {
        Stop-BlockChainNode
        Write-LogInfo "Blockchain stopped"
    }
}
