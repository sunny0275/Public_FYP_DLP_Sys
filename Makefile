PYTHON ?= python

.PHONY: build build-backend build-frontend docker-up docker-down docker-restart docker-rebuild
.PHONY: rotate-operational-key blockchain-start blockchain-stop blockchain-check blockchain-monitor

# =============================================================================
# Docker Management
# =============================================================================

docker-up:
	@docker compose up -d

docker-down:
	@docker compose down

docker-restart:
	@docker compose restart

docker-rebuild: build-backend docker-down docker-up

# =============================================================================
# Build Commands
# =============================================================================

build: build-backend build-frontend

build-backend:
	@cd backend && $(PYTHON) -m mvnw.cmd clean package -DskipTests -q 2>&1 || mvn clean package -DskipTests -q
	@echo "Backend JAR built successfully"

build-frontend:
	@cd frontend && npm run build
	@echo "Frontend built successfully"

# =============================================================================
# Key Rotation
# =============================================================================

rotate-operational-key:
	@if [ -z "$$NEW_KEY_ID" ]; then \
		echo "Usage: make rotate-operational-key NEW_KEY_ID=v2"; \
		exit 1; \
	fi; \
	$(PYTHON) scripts/rotate_operational_key.py "$$NEW_KEY_ID"

# =============================================================================
# Blockchain (Hardhat) Management
# =============================================================================

blockchain-start:
	@powershell -ExecutionPolicy Bypass -File scripts/blockchain-monitor.ps1 start http://localhost:8545

blockchain-stop:
	@powershell -ExecutionPolicy Bypass -File scripts/blockchain-monitor.ps1 stop http://localhost:8545

blockchain-check:
	@powershell -ExecutionPolicy Bypass -File scripts/blockchain-monitor.ps1 check http://localhost:8545

blockchain-monitor:
	@powershell -ExecutionPolicy Bypass -File scripts/blockchain-monitor.ps1 monitor http://localhost:8545

