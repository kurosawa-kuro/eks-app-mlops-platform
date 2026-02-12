# Hono Backend Makefile

.PHONY: help install setup dev build start test test-watch test-e2e test-e2e-ui test-e2e-headed clean kill-port doppler-setup doppler-check doppler-secrets config-check

help:
	@echo "Hono Backend - Available commands:"
	@echo ""
	@echo "Setup:"
	@echo "  install         - Install dependencies"
	@echo "  setup           - Install and setup Doppler"
	@echo ""
	@echo "Development:"
	@echo "  dev             - Kill port and start development server (via Doppler)"
	@echo "  build           - Build TypeScript"
	@echo "  start           - Start production server (via Doppler)"
	@echo ""
	@echo "Testing:"
	@echo "  test            - Run unit tests (Vitest)"
	@echo "  test-watch      - Run tests in watch mode"
	@echo "  test-e2e        - Run E2E tests (Playwright)"
	@echo "  test-e2e-ui     - Run E2E tests with UI"
	@echo "  test-e2e-headed - Run E2E tests with browser visible"
	@echo ""
	@echo "Doppler:"
	@echo "  doppler-setup   - Setup Doppler project/config"
	@echo "  doppler-check   - Check Doppler configuration"
	@echo "  doppler-secrets - List Doppler secrets (names only)"
	@echo ""
	@echo "Config (K8s ConfigMap):"
	@echo "  config-check    - Show ConfigMap file location"
	@echo ""
	@echo "Utilities:"
	@echo "  kill-port       - Kill process on port 8001"
	@echo "  clean           - Clean build artifacts"

install:
	npm install

setup: install doppler-setup
	@echo "Setup complete. Doppler is configured."

dev: kill-port
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm run test

test-watch:
	npm run test:watch

test-e2e:
	npm run test:e2e

test-e2e-ui:
	npm run test:e2e:ui

test-e2e-headed:
	npm run test:e2e:headed

kill-port:
	@fuser -k 8001/tcp 2>/dev/null || echo "Port 8001 is free"

clean:
	rm -rf dist docs/dist node_modules playwright-report test-results .playwright

# Doppler commands
doppler-setup:
	doppler setup

doppler-check:
	doppler configure

doppler-secrets:
	doppler secrets --only-names

# Config file management
config-check:
	@echo "ConfigMap file:"
	@ls -la env/config.json 2>/dev/null || echo "  [NOT FOUND] env/config.json"
	@echo ""
	@echo "K8s: Set CONFIG_FILE_PATH=/etc/config/config.json"
