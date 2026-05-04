# Enterprise Data Leakage Prevention System

A comprehensive DLP (Data Leakage Prevention) platform with secure document management, digital signatures, and blockchain auditing.

## Features

- **Secure Authentication**: JWT + MFA (TOTP)
- **Document Management**: Upload, classify, search, and share documents
- **Electronic Signatures**: Sign documents with blockchain anchoring
- **Workflow Approvals**: Multi-step approval workflows
- **Security Monitoring**: UEBA, EDR, and endpoint protection

---

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| **Docker Desktop** | Latest | Container runtime for backend, database & blockchain |
| **Git** | Latest | Version control |
| **Node.js** | 22 LTS | For Hardhat and Electron desktop app |
| **Java** | 17 LTS | Backend runtime |
| **.NET SDK** | 8.0 | Sidecar SecurityMonitor runtime |
| **Windows** | **10 / 11** (64-bit) | This project is tested on **Windows 11**; Windows 10 may experience compatibility issues with native Node modules (see [Hardhat ERR_DLOPEN_FAILED](#hardhat-err_dlopen_failed-windows)) |

> **Important**: Restart your computer after installing Docker Desktop to ensure the Docker daemon is running.

### Install Prerequisites (Windows)

> **Important**: Open PowerShell **as Administrator** (Right-click PowerShell → "Run as administrator")

If you don't have the required software installed, use Chocolatey to install them.

**Method 1: Step-by-Step (Recommended)**

```powershell
# Step 1: Set execution policy
Set-ExecutionPolicy Bypass -Scope CurrentUser -Force

# Step 2: Download install script to local file
Invoke-WebRequest -Uri https://chocolatey.org/install.ps1 -UseBasicParsing -OutFile "$env:TEMP\install.ps1"

# Step 3: Execute local script
& "$env:TEMP\install.ps1"

# Step 4: Restart PowerShell (as Administrator), then install software
choco install git docker-desktop nodejs-lts microsoft-openjdk17 microsoft-dotnet-sdk -y
```

### Verify Installation

```powershell
docker --version
git --version
node --version
java -version
dotnet --version
```

---

## First-Time Setup

### Step 1: Open the folder

```powershell
cd FYP_DLP_System
```

### Step 2: Configure Environment Variables (If you don't want to setup own development environment skip to Step 3)

> **Note**: If you are just developing locally and the `.env.example` defaults are acceptable, you may skip this step. The startup script will use the example values automatically.

```powershell
# Copy environment templates
copy .env.example .env
copy frontend\.env.example frontend\.env
```

Edit the `.env` file and configure the required values:

```env
# JWT secret for authentication (required)
JWT_SECRET=YOUR_JWT_SECRET_HERE

# Google Cloud / Vertex AI (optional, for AI classification)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_API_KEY=YOUR_VERTEX_API_KEY
```

> **Security**: Files in the `secrets` folder are ignored by `.gitignore` and will not be committed.

### Setting Up Google Cloud Storage (GCS)

If you want to use your own GCS bucket for document storage instead of local filesystem:

1. **Create a GCS Bucket**
   - Go to [Google Cloud Console](https://console.cloud.google.com/storage/) → **Create Bucket**
   - Choose a unique bucket name (e.g., `my-dlp-documents`)
   - Select **Region** or **Multi-region** based on your needs
   - Set **Access control** to **Uniform** (recommended)
   - Click **Create**

2. **Configure Environment Variables**
   - Add to your `.env` file:
     ```env
     GCS_BUCKET_NAME=your-bucket-name
     GCS_PROJECT_ID=your-gcp-project-id
     ```
   - Ensure GOOGLE_CLOUD_PROJECT is also set to the same project ID

3. **Service Account Permissions**
   - The service account key in `secrets/sa.json` must have **Storage Admin** (`roles/storage.admin`) or at least **Storage Object Admin** (`roles/storage.objectAdmin`) on the bucket.
   - In GCP Console: **IAM → Service accounts → select your service account → Permissions → Add permissions**

> **Note**: If GCS_BUCKET_NAME is not set, the system uses local filesystem storage (`uploads/` directory).

### Setting Up Vertex AI

If you want to use Vertex AI for document classification and analysis:

1. **Enable Vertex AI API**
   - In [Google Cloud Console](https://console.cloud.google.com/vertex-ai), click **"Enable API"** if not already enabled
   - Also enable: **Cloud Storage API** (if using GCS)

2. **Create a Service Account for Vertex AI**
   - Go to **IAM → Service accounts → Create Service Account**
   - Name: `vertex-express` (or any name)
   - Grant at least **Vertex AI User** (`roles/aiplatform.user`) role
   - If you plan to use **custom Vertex endpoints**, also grant **Vertex AI Endpoint Viewer** and **Vertex AI Endpoint Invoker**
   - Click **Done**

3. **Generate Service Account Key**
   - In the service account list, find your `vertex-express` account
   - Click **"Actions" (⋮) → Manage keys → Add key → Create new key**
   - Select **JSON** format, click **Create**
   - The key file will download automatically

4. **Save the Service Account Key**
   - Create the `secrets` folder at the project root if it does not exist:
     ```powershell
     if (-not (Test-Path secrets)) { New-Item -ItemType Directory -Path secrets }
     ```
   - Rename the downloaded JSON file to `sa.json` and place it in `secrets/`:
     ```
     FYP/
     ├── secrets/
     │   └── sa.json    ← Place your service account key here
     ├── docker-compose.yml
     └── ...
     ```
   - **Important**: `secrets/sa.json` is listed in `.gitignore` and will **never** be committed to Git.

5. **Configure Environment Variables**
   - In `.env` file, set:
     ```env
     GOOGLE_CLOUD_PROJECT=your-gcp-project-id
     GOOGLE_CLOUD_LOCATION=us-central1  # or your preferred region
     VERTEX_API_KEY=YOUR_VERTEX_API_KEY  # optional for some endpoints
     ```
   - For production deployments using Vertex AI endpoints (not just API key), you can also set:
     ```env
     VERTEX_ENDPOINT_ID=your-endpoint-id
     ```

### About the `secrets/sa.json` File

The `secrets/sa.json` file is your **Google Cloud service account key**. It is used by the application to authenticate with Google Cloud services (Vertex AI, GCS, etc.) using **Application Default Credentials (ADC)**.

- **Location**: `secrets/sa.json` at the project root (same level as `docker-compose.yml`)
- **Format**: JSON key downloaded from GCP IAM
- **Permissions**: The service account needs appropriate roles (e.g., `roles/aiplatform.user`, `roles/storage.objectAdmin`)
- **Docker Mount**: The backend container mounts this file at `/app/secrets/sa.json` and sets `GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/sa.json`

**If you don't have `secrets/sa.json` yet**:
1. Follow the "Create a Service Account for Vertex AI" steps above
2. Download the JSON key and save it as `secrets/sa.json`
3. Restart the backend: `docker compose restart backend`

**On a new machine**:
- Copy `secrets/sa.json` from your secure backup
- Keep the same path: `FYP/secrets/sa.json`
- No need to recreate the key in GCP (unless you rotated/deleted it)

**Rotating keys**:
- If you delete or rotate the key in GCP, download a **new** key and replace `secrets/sa.json` on **all** machines
- Old keys will stop working immediately

More details: `secrets/README.md`.

> **Note**: The provided `secrets/sa.json` in this repo (if present) is a placeholder or demo key and may not work in your environment. Always use **your own** service account key for production or development.

### Setting Up Google Cloud Storage (GCS)

If you want to use your own GCS bucket for document storage instead of local filesystem:

1. **Create a GCS Bucket**
   - Go to [Google Cloud Console](https://console.cloud.google.com/storage/) → **Create Bucket**
   - Choose a unique bucket name (e.g., `my-dlp-documents`)
   - Select **Region** or **Multi-region** based on your needs
   - Set **Access control** to **Uniform** (recommended)
   - Click **Create**

2. **Configure Environment Variables**
   - Add to your `.env` file:
     ```env
     GCS_BUCKET_NAME=your-bucket-name
     GCS_PROJECT_ID=your-gcp-project-id
     ```
   - Ensure GOOGLE_CLOUD_PROJECT is also set to the same project ID

3. **Service Account Permissions**
   - The service account key in `secrets/sa.json` must have **Storage Admin** (`roles/storage.admin`) or at least **Storage Object Admin** (`roles/storage.objectAdmin`) on the bucket.
   - In GCP Console: **IAM → Service accounts → select your service account → Permissions → Add permissions**

> **Note**: If GCS_BUCKET_NAME is not set, the system uses local filesystem storage (`uploads/` directory).

### Setting Up Vertex AI

If you want to use Vertex AI for document classification and analysis:

1. **Enable Vertex AI API**
   - In [Google Cloud Console](https://console.cloud.google.com/vertex-ai), click **"Enable API"** if not already enabled
   - Also enable: **Cloud Storage API** (if using GCS)

2. **Create a Service Account for Vertex AI**
   - Go to **IAM → Service accounts → Create Service Account**
   - Name: `vertex-express` (or any name)
   - Grant at least **Vertex AI User** (`roles/aiplatform.user`) role
   - If you plan to use **custom Vertex endpoints**, also grant **Vertex AI Endpoint Viewer** and **Vertex AI Endpoint Invoker**
   - Click **Done**

3. **Generate Service Account Key**
   - In the service account list, find your `vertex-express` account
   - Click **"Actions" (⋮) → Manage keys → Add key → Create new key**
   - Select **JSON** format, click **Create**
   - The key file will download automatically

4. **Save the Service Account Key**
   - Create the `secrets` folder at the project root if it does not exist:
     ```powershell
     if (-not (Test-Path secrets)) { New-Item -ItemType Directory -Path secrets }
     ```
   - Rename the downloaded JSON file to `sa.json` and place it in `secrets/`:
     ```
     FYP/
     ├── secrets/
     │   └── sa.json    ← Place your service account key here
     ├── docker-compose.yml
     └── ...
     ```
   - **Important**: `secrets/sa.json` is listed in `.gitignore` and will **never** be committed to Git.

5. **Configure Environment Variables**
   - In `.env` file, set:
     ```env
     GOOGLE_CLOUD_PROJECT=your-gcp-project-id
     GOOGLE_CLOUD_LOCATION=us-central1  # or your preferred region
     VERTEX_API_KEY=YOUR_VERTEX_API_KEY  # optional for some endpoints
     ```
   - For production deployments using Vertex AI endpoints (not just API key), you can also set:
     ```env
     VERTEX_ENDPOINT_ID=your-endpoint-id
     ```

> **⚠️ Security Warning**: Never commit `secrets/sa.json` to version control. The file contains private keys that grant access to your GCP resources. If accidentally committed, **revoke the key immediately** in GCP Console and generate a new one.

### About the `secrets/sa.json` File

The `secrets/sa.json` file is your **Google Cloud service account key**. It is used by the application to authenticate with Google Cloud services (Vertex AI, GCS, etc.) using **Application Default Credentials (ADC)**.

- **Location**: `secrets/sa.json` at the project root (same level as `docker-compose.yml`)
- **Format**: JSON key downloaded from GCP IAM
- **Permissions**: The service account needs appropriate roles (e.g., `roles/aiplatform.user`, `roles/storage.objectAdmin`)
- **Docker Mount**: The backend container mounts this file at `/app/secrets/sa.json` and sets `GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/sa.json`

**If you don't have `secrets/sa.json` yet**:
1. Follow the "Create a Service Account for Vertex AI" steps above
2. Download the JSON key and save it as `secrets/sa.json`
3. Restart the backend: `docker compose restart backend`

**On a new machine**:
- Copy `secrets/sa.json` from your secure backup
- Keep the same path: `FYP/secrets/sa.json`
- No need to recreate the key in GCP (unless you rotated/deleted it)

**Rotating keys**:
- If you delete or rotate the key in GCP, download a **new** key and replace `secrets/sa.json` on **all** machines
- Old keys will stop working immediately

More details: `secrets/README.md`.

> **Note**: The provided `secrets/sa.json` in this repo (if present) is a placeholder or demo key and may not work in your environment. Always use **your own** service account key for production or development.

### Secrets & Vertex AI (service account)

LLM health checks in **endpoint / OAuth** mode (`VERTEX_ENDPOINT_ID` set, or whenever the app uses ADC instead of API-key-only flows) need a valid Google credential. Docker maps the key into the backend as **`GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/sa.json`**.

**One-time setup in Google Cloud**

1. In **GCP Console → IAM → Service accounts**, select or create a service account in the same project as **`GOOGLE_CLOUD_PROJECT`** (e.g. Vertex usage).
2. Grant at least **Vertex AI User** (`roles/aiplatform.user`). If you use **custom Vertex endpoints**, ensure this account can invoke those endpoints.
3. **Keys → Add key → JSON**, download the file, and save it as **`secrets/sa.json`** at the repo root (same folder as `docker-compose.yml`).

**New PC / another machine (you already have the secrets)**

You **do not** need to repeat the GCP “create key” steps on every computer.

- Copy from your **own secure backup** (Git will not contain these): **`secrets/sa.json`**, **`secrets/pki/`** if you reuse the same CA, and **`.env`** (or rebuild `.env` from `.env.example` with the same values).
- Keep the same paths under the project, then run **`docker compose up -d --build`** or **`.\scripts\start-dev.ps1`**.
- If you **rotate or delete** the key in GCP, every copy of the old JSON stops working; download **one** new key and replace `secrets/sa.json` on each machine that needs it.

More detail: `secrets/README.md`.

### Step 3: Build SecurityMonitor Sidecar

The SecurityMonitor sidecar requires .NET 8.0 SDK for the Electron app's deep security monitoring (EDR capabilities).

```powershell
cd sidecar\SecurityMonitor
dotnet build -c Release -o ./bin
cd ..\..
```

> **Note**: Run `dotnet dev-certs https --trust` if prompted to trust the .NET development certificate.

### Step 4: Create Required Directories

```powershell
if (-not (Test-Path secrets)) { New-Item -ItemType Directory -Path secrets }
```

### Step 5: Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

### Step 6: Install Blockchain Dependencies (Required for Hardhat)

This repo pins **Hardhat 2.20.1** (last line before the `@nomicfoundation/edr` native dependency). Newer Hardhat 2.x still ships EDR and can hit `edr-win32-x64-msvc.node` / `ERR_DLOPEN_FAILED` on **Windows 10**. Tested on **Windows 11**.

```powershell
cd eth-testnet
npm install
cd ..
```

> If you still see `ERR_DLOPEN_FAILED` or `edr-…` paths, you likely have **leftover Hardhat 3** `node_modules`. Delete `eth-testnet/node_modules` and `eth-testnet/package-lock.json`, then run `npm install` again in `eth-testnet/`.

### Step 7: Start the System

> **⚠️ Important**: Always run the startup script with **Administrator privileges**!
> The SecurityMonitor sidecar requires admin rights for full EDR capabilities (process monitoring, USB control).

#### Option A: Using the Startup Script (Recommended)

1. First Start docker build
```powershell
docker compose up -d --build
```
> **Docker build cache** — if an error appears, it may be that Docker is still using the old cache layer (#12 CACHED), causing newly added DTO files not to be copied to the image.

>Use `docker builder prune -f` to clear the build cache.

1. Right-click **PowerShell** → **"Run as administrator"**
2. Navigate to project: `.\FYP_DLP_System`
3. Run the startup script:

```powershell
.\scripts\start-dev.ps1
```

> **First-time setup**: The initial run will:
> - Download dependencies (npm, maven)
> - Build Docker images (~1-2 GB, may take 5-10 minutes)
> - Pull base images (PostgreSQL, Java, Node, Nginx)
> - Create and start containers
>
> **Subsequent startups** will be faster as images are cached.

#### Quick Start (After First Run)

Once Docker images are built locally, you can use:

```powershell
# Fastest: skip rebuild, just start containers
.\scripts\start-dev.ps1 -SkipBuild

# With blockchain + Electron
.\scripts\start-dev.ps1

# Backend + blockchain only (no Electron)
.\scripts\start-dev.ps1 -NoElectron
```

#### Startup Script Options

| Parameter | Description |
|-----------|-------------|
| `-SkipBuild` | Skip Docker build, start containers directly (if already built) |
| `-NoBlockchain` | Do not start blockchain node |
| `-NoElectron` | Do not start Electron desktop app |

#### When to Rebuild

| Scenario | Command |
|----------|---------|
| **First-time setup** | `.\scripts\start-dev.ps1` |
| **Subsequent (no code changes)** | `.\scripts\start-dev.ps1 -SkipBuild` |
| **Code changed (backend/frontend)** | `.\scripts\start-dev.ps1` (auto-detect and rebuild) |
| **Force full rebuild** | `docker compose up -d --build` |
| **Manual rebuild & start** | `docker compose up -d --build` |

Examples:

```powershell
# Quick start (skip build)
.\scripts\start-dev.ps1 -SkipBuild

# Backend and database only
.\scripts\start-dev.ps1 -NoBlockchain -NoElectron

# Blockchain only (for testing)
.\scripts\start-dev.ps1 -NoElectron
```

#### Startup Sequence

The script automatically runs in this order:

1. **Build SecurityMonitor** (C# EDR sidecar) - if source changed
2. **Start Blockchain** (Hardhat) - if not already running
3. **Start Docker** (Backend + PostgreSQL) - always
4. **Start Electron** - if not skipped

#### Option B: Manual Startup

```powershell
# 1. Start PostgreSQL and backend
docker compose up -d

# 2. (Optional) Build and start SecurityMonitor sidecar (requires .NET 8.0 SDK)
cd sidecar\SecurityMonitor
dotnet publish -c Release -o ./bin/publish
# Run via dotnet DLL (requires admin privileges)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'sidecar\SecurityMonitor\bin\publish'; dotnet SecurityMonitor.dll"
cd ..\..

# 3. (Optional) Start blockchain node
cd eth-testnet
npx hardhat node --port 18545

# 4. (Optional) Start Electron desktop app
cd frontend
npm run electron:dev
```

> **Note**: For development, use `dotnet build -c Release -o ./bin` instead of `publish`.

### Step 6: Verify Services

```powershell
# Check container status
docker compose ps

# View backend logs
docker compose logs backend

# View database logs
docker compose logs postgres
```

Service URLs:

| Service | URL |
|---------|-----|
| **Electron Desktop App** | Opens automatically |
| **Backend API** | http://localhost:18080/api |
| **Blockchain Node RPC** | http://127.0.0.1:8545 |
| **Blockchain Health Monitor** | Running in separate window |

---

## Default Login Credentials

Use **account ID** `admin` (not email) in the login form unless the UI labels otherwise.

| Role | Account ID | Default password |
|------|------------|------------------|
| Admin | `admin` | `Opgg-58147321` |

Set environment variable **`ADMIN_PASSWORD`** (loaded via `.env` for `docker compose`) to override; it maps to `security.admin.password` in `backend/src/main/resources/application.yml`. The backend overwrites the admin password hash on startup from that value.

> **First login**: You will be required to change your password and set up MFA.

---

## Stopping the System

```powershell
docker compose down
```

To stop the Hardhat blockchain node, close its PowerShell window or terminate the process.

---

## Troubleshooting (Windows 10)

### `unable to get image '…': … 500 Internal Server Error` (`dockerDesktopLinuxEngine`)

You may see this for **`postgres:16-alpine`**, **`fyp-frontend`**, or any other image. The message often mentions **API route / v1.54** — that is usually misleading: the **Docker Desktop Linux engine** is unhealthy or stuck, not your `docker-compose.yml`.

Try in order:

1. **Quit Docker Desktop fully** (system tray → **Quit Docker Desktop**), wait ~10 seconds, start it again. Wait until it says **Docker Desktop is running** (whale icon steady).
2. **Reset WSL2** (common fix on Win10 when the engine returns 500):
   ```powershell
   wsl --shutdown
   ```
   Then start **Docker Desktop** again and wait until it is ready.
3. In PowerShell: **`docker info`**. If that errors, do not run `docker compose` yet — fix Docker/WSL first.
4. **Smoke-test a pull** (same error here means the engine is still broken, not this repo):
   ```powershell
   docker pull postgres:16-alpine
   ```
5. If pulls work but Compose still fails: from the project folder:
   ```powershell
   docker compose down
   docker compose up -d --build
   ```
6. **Remove broken / cached images** (optional), then rebuild app images:
   ```powershell
   docker rmi fyp-frontend:latest fyp-backend:latest -f 2>$null
   docker compose build --no-cache
   docker compose up -d
   ```
7. Still failing: **Docker Desktop → Troubleshoot → Restart** or **Clean / Purge data** (or **Reset to factory defaults**) — local images/containers are removed. Use `docker compose down -v` only if you intend to wipe the database volume.
8. **Update Docker Desktop** to the latest stable build and install **Windows updates**. On Win10, ensure **WSL2** is the Docker backend (**Settings → General**) and run `wsl --update` in an elevated PowerShell if offered.

### Compose warning: project loaded from a **symlink**

Docker Compose can behave oddly when the project directory is a **symlink/junction** (e.g. Desktop shortcut to another drive). Prefer cloning or copying the repo to a **normal path** such as `C:\Users\<you>\src\FYP_DLP_System` and run `.\scripts\start-dev.ps1` from there.

The compose file sets an explicit project name (`name: fyp`) so behavior does not depend on how the folder is resolved.

---

## Project Structure

```
FYP/
├── backend/           # Spring Boot REST API (JAR built in Docker)
├── frontend/          # React + Vite web app
│   ├── electron/      # Electron desktop wrapper
│   └── src/           # React components
├── eth-testnet/       # Hardhat blockchain configuration
├── sidecar/
│   └── SecurityMonitor/   # C# EDR sidecar (requires .NET 8.0 SDK)
├── scripts/           # Helper scripts
│   ├── start-dev.ps1  # Main startup script
│   └── blockchain-monitor.ps1
├── secrets/           # Sensitive credentials (git-ignored)
├── .env.example       # Environment template
├── Dockerfile.local   # Docker build for backend
└── docker-compose.yml # Container orchestration
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | User authentication |
| `GET /api/documents` | List documents |
| `POST /api/documents/upload` | Upload document |
| `POST /api/signatures` | Create signature |
| `GET /api/audit/logs` | View audit logs |

---

## Electron Desktop App

The project includes an optional Electron desktop wrapper for the React/Vite frontend.

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Electron in Development

1. Start backend + database first:

```bash
docker compose up -d
```

2. Start Electron dev mode:

```bash
cd frontend
npm run electron:dev
```

### Build Production Installer (Windows)

```bash
cd frontend
npm run electron:build:win
```

Output goes to `frontend/release-electron/`.

### Configuration

**Backend URL Discovery**: The Electron app automatically discovers the backend URL. It first checks `ELECTRON_API_BASE_URL` or `VITE_API_BASE_URL` environment variables, then tries common URLs.

**Conditional Logging**: Security events (screenshot/recording tool detection) are only sent to the backend when the user is actively viewing documents, reducing false positives.

### Notes
- Frontend changes under `frontend/src/` hot-reload via Vite.
- Changes to Electron files (`frontend/electron/main.ts`, `frontend/electron/preload.ts`) require restarting the Electron window.
- If the window shows a load error briefly, Vite is still starting; it will retry automatically.

---

## Troubleshooting

### Build fails with encoding errors (e.g., "unmappable character")
This may happen if Windows Git converts Java files to UTF-16 encoding. The `Dockerfile.local` includes an automatic fix for this.

### Backend won't start
- Ensure `.env` file exists with `JWT_SECRET` defined
- Check Docker Desktop is running: `docker compose logs -f backend`

### Port 3000 already in use
```powershell
$env:FRONTEND_PORT="3001"
docker compose up -d --build
```

### Electron app is slow
- Check `frontend/electron/main.ts` for performance settings
- Reduce monitoring intervals if needed

### MFA codes don't work
- Ensure your computer clock is synced (TOTP is time-based)

### `git pull` aborts: `eth-testnet/package-lock.json` would be overwritten
You have a local `package-lock.json` (e.g. from an old clone or `npm install`) while the remote removed it. From the repo root:
```powershell
git restore eth-testnet/package-lock.json
git pull origin main
```
If `git restore` fails, delete the file and pull again: `Remove-Item -Force eth-testnet\package-lock.json` then `git pull origin main`.

### Hardhat `ERR_DLOPEN_FAILED` (Windows)
This project uses **Hardhat 2.20.1** (no EDR). Remove stale installs, then reinstall:

```powershell
cd eth-testnet
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npx hardhat --version
```

If errors still mention `edr-win32-x64-msvc`, ensure you pulled the latest `package.json` and are not copying `node_modules` from another machine.

## License

This is a capstone project. All rights reserved.
