# Auth Service Makefile
# =====================

.PHONY: help install dev build start test test-e2e clean \
        docker-build docker-run docker-stop \
        lambda-build lambda-zip \
        cognito-users cognito-verify cognito-list

# デフォルトターゲット
.DEFAULT_GOAL := help

# 変数
IMAGE_NAME := auth-service
PORT := 8001
POOL_ID := ap-northeast-1_XXXXXXXXX

# ============================================
# ヘルプ
# ============================================

help: ## ヘルプを表示
	@echo ""
	@echo "Auth Service - 利用可能なコマンド"
	@echo "=================================="
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ============================================
# 開発
# ============================================

install: ## 依存関係をインストール
	npm install

dev: ## 開発サーバーを起動（ホットリロード）
	npm run dev

build: ## TypeScript をビルド
	npm run build

start: ## 本番サーバーを起動
	npm run start

# ============================================
# テスト
# ============================================

test: ## ユニットテストを実行
	npm run test

test-e2e: ## E2E テストを実行
	npm run test:e2e

test-all: test test-e2e ## 全テストを実行

# ============================================
# Docker
# ============================================

docker-build: ## Docker イメージをビルド
	docker build -t $(IMAGE_NAME) .

docker-run: ## Docker コンテナを起動
	docker run -d --name $(IMAGE_NAME) -p $(PORT):$(PORT) \
		-e PORT=$(PORT) \
		-e AUTH_PROVIDER=dummy \
		$(IMAGE_NAME)

docker-stop: ## Docker コンテナを停止・削除
	docker stop $(IMAGE_NAME) || true
	docker rm $(IMAGE_NAME) || true

docker-logs: ## Docker ログを表示
	docker logs -f $(IMAGE_NAME)

# ============================================
# Lambda
# ============================================

lambda-build: ## Lambda 用にビルド
	npm run build:lambda

lambda-zip: lambda-build ## Lambda デプロイ用 zip を作成
	cd dist && zip -r ../auth-lambda.zip .
	zip -r auth-lambda.zip node_modules
	@echo "Created: auth-lambda.zip"

# ============================================
# Cognito ユーザー管理
# ============================================

cognito-users: ## PoC ユーザーを作成
	./scripts/setup-poc-users.sh

cognito-verify: ## PoC ユーザーのログインを検証
	./scripts/verify-poc-users.sh

cognito-list: ## Cognito ユーザー一覧を表示
	cd ../.. && cd scripts && npx tsx infra/aws/cognito-manage.ts users $(POOL_ID)

# ============================================
# ヘルスチェック
# ============================================

health: ## ヘルスチェックを実行
	@curl -s http://localhost:$(PORT)/health | jq . || echo "Server not running"

login-test: ## ログインテストを実行（Dummy モード）
	@curl -s -X POST http://localhost:$(PORT)/auth/login \
		-H "Content-Type: application/json" \
		-d '{"username":"admin","password":"password"}' | jq .

# ============================================
# クリーンアップ
# ============================================

clean: ## ビルド成果物を削除
	rm -rf dist
	rm -f auth-lambda.zip

clean-all: clean ## node_modules も含めて削除
	rm -rf node_modules

# ============================================
# 情報表示
# ============================================

info: ## プロジェクト情報を表示
	@echo "Auth Service"
	@echo "============"
	@echo "Port:          $(PORT)"
	@echo "Pool ID:       $(POOL_ID)"
	@echo "Node version:  $$(node -v)"
	@echo "npm version:   $$(npm -v)"
