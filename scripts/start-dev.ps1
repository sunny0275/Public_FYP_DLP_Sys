param(
    [switch]$NoBlockchain,
    [switch]$SkipBuild,
    [switch]$NoElectron
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Check for Administrator privileges
# =============================================================================
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "ERROR: Administrator privileges required!" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "This script must be run as Administrator to:"
    Write-Host "  - Build and run SecurityMonitor.exe"
    Write-Host "  - Monitor system processes and events"
    Write-Host "  - Control USB storage devices"
    Write-Host "  - Access Windows event logs"
    Write-Host ""
    Write-Host "Please restart this script with Administrator privileges."
    Write-Host ""
    Write-Host "To run as Administrator:"
    Write-Host "  1. Right-click PowerShell"
    Write-Host "  2. Select 'Run as Administrator'"
    Write-Host "  3. Run: .\scripts\start-dev.ps1"
    Write-Host ""
    exit 1
}

Write-Host "============================================" -ForegroundColor Green
Write-Host "Running with Administrator privileges" -ForegroundColor Green
Write-Host "============================================"
Write-Host ""

function Test-RpcReady {
    param(
        [Parameter(Mandatory = $true)][string]$RpcUrl
    )
    try {
        $headers = @{ "Content-Type" = "application/json" }
        $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
        $null = Invoke-RestMethod -Method Post -Uri $RpcUrl -Headers $headers -Body $body -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

function Wait-RpcReady {
    param(
        [Parameter(Mandatory = $true)][string]$RpcUrl,
        [int]$TimeoutSeconds = 25
    )
    $started = Get-Date
    while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSeconds) {
        if (Test-RpcReady -RpcUrl $RpcUrl) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Test-PortBindable {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [string]$Address = "0.0.0.0"
    )
    $listener = $null
    try {
        $ip = [System.Net.IPAddress]::Parse($Address)
        $listener = [System.Net.Sockets.TcpListener]::new($ip, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) {
            try { $listener.Stop() } catch {}
        }
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ethTestnetDir = Join-Path $repoRoot "eth-testnet"
$sidecarDir = Join-Path $repoRoot "sidecar\SecurityMonitor"
$preferredRpcPorts = @(8545, 18545, 28545)
$selectedRpcPort = $null
$defaultHardhatKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$DEV_PORT = 5173

Write-Host "Repo root: $repoRoot"

# =============================================================================
# Build SecurityMonitor Sidecar (C# EDR)
# =============================================================================
Write-Host ""
Write-Host "[1/4] Building SecurityMonitor sidecar..."
if (Test-Path $sidecarDir) {
    Push-Location $sidecarDir
    try {
        $sidecarExe = Join-Path $sidecarDir "bin\SecurityMonitor.exe"
        $needsBuild = $true

        if (Test-Path $sidecarExe) {
            $sidecarCsproj = Join-Path $sidecarDir "SecurityMonitor.csproj"
            $dllLastWrite = (Get-Item $sidecarExe).LastWriteTime
            $csprojLastWrite = (Get-Item $sidecarCsproj).LastWriteTime
            if ($dllLastWrite -gt $csprojLastWrite) {
                $needsBuild = $false
                Write-Host "  SecurityMonitor.exe is up-to-date, skipping build."
            }
        }

        if ($needsBuild) {
            Write-Host "  Building SecurityMonitor..."
            $buildResult = dotnet build -c Release -o ./bin 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  SecurityMonitor built successfully."
            } else {
                Write-Host "  [WARN] SecurityMonitor build failed, Electron may lack EDR features." -ForegroundColor Yellow
                Write-Host "  Error: $buildResult"
            }
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "  [WARN] SecurityMonitor source not found at $sidecarDir" -ForegroundColor Yellow
}

# =============================================================================
# Start Blockchain (Hardhat)
# =============================================================================
Write-Host ""
Write-Host "[2/4] Checking blockchain..."

if (-not $NoBlockchain) {
    if (-not (Test-Path $ethTestnetDir)) {
        Write-Host "  [WARN] eth-testnet folder not found, blockchain disabled." -ForegroundColor Yellow
        $NoBlockchain = $true
    }

    foreach ($candidatePort in $preferredRpcPorts) {
        $candidateRpcUrl = "http://127.0.0.1:$candidatePort"
        if (Test-RpcReady -RpcUrl $candidateRpcUrl) {
            $selectedRpcPort = $candidatePort
            Write-Host "  Hardhat RPC already running: $candidateRpcUrl"
            break
        }
    }

    if ($null -eq $selectedRpcPort) {
        foreach ($candidatePort in $preferredRpcPorts) {
            if (-not (Test-PortBindable -Port $candidatePort -Address "0.0.0.0")) {
                Write-Host "  Port $candidatePort is unavailable, trying next..."
                continue
            }

            Write-Host "  Starting Hardhat node on port $candidatePort..."
            $hardhatCommand = "cd '$ethTestnetDir'; npx hardhat node --hostname 0.0.0.0 --port $candidatePort"
            Start-Process powershell -ArgumentList "-NoExit", "-Command", $hardhatCommand | Out-Null

            if (Wait-RpcReady -RpcUrl "http://127.0.0.1:$candidatePort" -TimeoutSeconds 30) {
                $selectedRpcPort = $candidatePort
                break
            }
        }
    }

    if ($null -eq $selectedRpcPort) {
        Write-Host "  [WARN] Hardhat RPC failed to start, blockchain disabled." -ForegroundColor Yellow
        $NoBlockchain = $true
    }

    if (-not $NoBlockchain) {
        $rpcHostUrl = "http://127.0.0.1:$selectedRpcPort"
        $rpcDockerUrl = "http://host.docker.internal:$selectedRpcPort"
        Write-Host "  Hardhat node ready: $rpcHostUrl"

        # Start blockchain health monitor in background
        $monitorScript = Join-Path $PSScriptRoot "blockchain-monitor.ps1"
        if (Test-Path $monitorScript) {
            Write-Host "  Starting blockchain health monitor..."
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; .\$($monitorScript.Substring($monitorScript.LastIndexOf('\') + 1)) monitor $rpcHostUrl" | Out-Null
            Write-Host "  Blockchain health monitor started."
        }

        $env:DLP_BLOCKCHAIN_ENABLED = "true"
        $env:DLP_BLOCKCHAIN_RPC_URL = $rpcDockerUrl
        $env:DLP_BLOCKCHAIN_CHAIN_ID = "31337"

        if ([string]::IsNullOrWhiteSpace($env:DLP_BLOCKCHAIN_PRIVATE_KEY)) {
            $env:DLP_BLOCKCHAIN_PRIVATE_KEY = $defaultHardhatKey
            Write-Host "  Using default Hardhat private key (dev only)."
        }
    } else {
        $env:DLP_BLOCKCHAIN_ENABLED = "false"
    }
} else {
    Write-Host "  Blockchain disabled by parameter."
    $env:DLP_BLOCKCHAIN_ENABLED = "false"
}

# =============================================================================
# Start Docker Containers (Backend + Database)
# =============================================================================
Write-Host ""
Write-Host "[3/4] Starting Docker containers..."

Push-Location $repoRoot
try {
    # Check if images exist - if yes, skip build
    $backendImage = docker images fyp-backend:latest --format "{{.Repository}}:{{.Tag}}" 2>$null
    $frontendImage = docker images fyp-frontend:latest --format "{{.Repository}}:{{.Tag}}" 2>$null
    
    if ($SkipBuild -or ($backendImage -and $frontendImage)) {
        Write-Host "  Running: docker compose up -d (images exist, skip build)"
        try { docker compose up -d } catch { }
    } else {
        Write-Host "  Running: docker compose up -d --build"
        try { docker compose up -d --build } catch { }
    }
    
    # Wait for containers to start (max 60 seconds)
    Write-Host "  Waiting for containers to start..."
    $maxWait = 60
    $waited = 0
    while ($waited -lt $maxWait) {
        $runningContainers = docker ps --format "{{.Names}}" 2>$null
        if ($runningContainers -match "dlp-postgres" -and $runningContainers -match "dlp-backend" -and $runningContainers -match "dlp-frontend") {
            Write-Host "  All containers are running!" -ForegroundColor Green
            break
        }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "  Waiting... ($waited/$maxWait)s"
    }
    
    # Check final status
    Write-Host ""
    Write-Host "  Container Status:"
    docker ps --format "    {{.Names}}: {{.Status}}"
    
    # Check for failed containers
    $failedContainers = docker ps -a --filter "status=exited" --filter "status=restarting" --format "{{.Names}}"
    if ($failedContainers) {
        Write-Host ""
        Write-Host "  [WARN] Some containers failed to start:" -ForegroundColor Yellow
        foreach ($container in $failedContainers) {
            Write-Host "    - $container" -ForegroundColor Yellow
            $logs = docker logs $container --tail 10 2>&1
            Write-Host "    Last logs:" -ForegroundColor Yellow
            $logs | Select-Object -First 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
    }
    
} finally {
    Pop-Location
}

# =============================================================================
# Kill existing SecurityMonitor instances (prevent pipe conflicts)
# =============================================================================
Write-Host ""
Write-Host "[Sidecar] Checking for existing SecurityMonitor instances..."
$existingProcs = Get-Process -Name "SecurityMonitor" -ErrorAction SilentlyContinue
if ($existingProcs) {
    Write-Host "  Found $($existingProcs.Count) existing instance(s), terminating..."
    $existingProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Write-Host "  Terminated."
}

# =============================================================================
# Kill existing Electron instances (prevent port conflicts and stale state)
# =============================================================================
Write-Host ""
Write-Host "[Electron] Checking for existing Electron instances..."
$electronProcs = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcs) {
    Write-Host "  Found $($electronProcs.Count) existing Electron instance(s), terminating..."
    $electronProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Write-Host "  Terminated."
}

# =============================================================================
# Kill existing Node processes on Vite dev port to free the port
# =============================================================================
Write-Host ""
Write-Host "[Vite] Checking for processes on port $DEV_PORT..."
$portProcess = Get-NetTCPConnection -LocalPort $DEV_PORT -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcess) {
    $portProcs = Get-Process -Id $portProcess -ErrorAction SilentlyContinue
    if ($portProcs) {
        Write-Host "  Found $($portProcs.Count) process(es) using port $DEV_PORT, terminating..."
        $portProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Host "  Terminated."
    }
}

# Give everything time to fully terminate
Write-Host ""
Write-Host "[Cleanup] Waiting for processes to fully terminate..."
Start-Sleep -Seconds 1

# =============================================================================
# Start SecurityMonitor Sidecar (C# EDR) - MUST run as Administrator
# =============================================================================
Write-Host ""
Write-Host "[Sidecar] Starting SecurityMonitor.exe..."
$sidecarBinDir = Join-Path $sidecarDir "bin"
$sidecarExe = Join-Path $sidecarBinDir "SecurityMonitor.exe"
if (Test-Path $sidecarExe) {
    Write-Host "  Launching SecurityMonitor.exe (via dotnet DLL)..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$sidecarBinDir'; dotnet SecurityMonitor.dll" -WindowStyle Normal
    Write-Host "  SecurityMonitor.exe started."
} else {
    Write-Host "  [WARN] SecurityMonitor.exe not found at $sidecarExe" -ForegroundColor Yellow
}

# =============================================================================
# Rebuild Electron (sync TypeScript -> JavaScript)
# =============================================================================
Write-Host ""
Write-Host "[3.5/4] Rebuilding Electron (TypeScript -> JavaScript)..."
$frontendDir = Join-Path $repoRoot "frontend"
Push-Location $frontendDir
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] Electron build had issues, continuing anyway..." -ForegroundColor Yellow
    } else {
        Write-Host "  Electron rebuilt successfully."
    }
} finally {
    Pop-Location
}

# =============================================================================
# Check dist-electron/main.js for auth token bug (double write fix)
# =============================================================================
$distMainJs = Join-Path $frontendDir "dist-electron\main.js"
if (Test-Path $distMainJs) {
    $content = Get-Content $distMainJs -Raw
    if ($content -match "socket\.write\(SIDECAR_AUTH_TOKEN.*\n.*socket\.write\(command") {
        Write-Host "  [WARN] Bug detected: dist-electron/main.js still has double socket.write!" -ForegroundColor Yellow
        Write-Host "  Manually patching dist-electron/main.js..."
        $content = $content -replace "socket\.write\(SIDECAR_AUTH_TOKEN \+ ['\x22]\\n['\x22]\);[\s\n]*socket\.write\(command", "socket.write(command"
        Set-Content -Path $distMainJs -Value $content -NoNewline
        Write-Host "  Patched successfully."
    } else {
        Write-Host "  dist-electron/main.js looks OK (no double socket.write bug)."
    }
}

# =============================================================================
# Start Electron App
# NOTE: 'npm run dev' starts BOTH Vite dev server AND Electron via vite-plugin-electron
# DO NOT start electron separately - vite-plugin-electron handles it!
# =============================================================================
Write-Host ""
Write-Host "[4/4] Starting Electron app..."

$frontendDir = Join-Path $repoRoot "frontend"
if (-not $NoElectron) {
    # Set VITE_DEV_PORT env var for electron
    Write-Host "  Starting Vite dev server + Electron (port $DEV_PORT)..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; `$env:VITE_DEV_PORT='$DEV_PORT'; npm run dev" -WindowStyle Normal -Wait:$false
    
    Write-Host "  Vite + Electron started."
    Write-Host "  NOTE: To rebuild Electron after code changes, run 'npm run build' in frontend folder"
}

Write-Host ""
Write-Host "============================================"
Write-Host "All services started successfully!"
Write-Host "============================================"
Write-Host ""
Write-Host "Services:"
Write-Host "  Backend API: http://localhost:18080/api"
if (-not $NoBlockchain) {
    Write-Host "  Blockchain RPC (host): $rpcHostUrl"
    Write-Host "  Blockchain RPC (docker): $rpcDockerUrl"
    Write-Host "  Blockchain monitor: Running in separate window"
}
if (-not $NoElectron) {
    Write-Host "  Electron: Running in separate window (Vite port: $DEV_PORT)"
}
Write-Host ""
