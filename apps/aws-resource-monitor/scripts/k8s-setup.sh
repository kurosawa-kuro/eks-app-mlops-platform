#!/bin/bash
# kubeconfig をローカルトンネル用に設定
# 設定は k8s-config.json から読み込み

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/k8s-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file not found: $CONFIG_FILE"
  exit 1
fi

# jqで設定読み込み
CLUSTER_NAME=$(jq -r '.eksClusterName' "$CONFIG_FILE")
REGION=$(jq -r '.region' "$CONFIG_FILE")
LOCAL_PORT=$(jq -r '.localPort' "$CONFIG_FILE")

echo "=========================================="
echo "EKS kubeconfig Setup"
echo "=========================================="
echo "Cluster:    $CLUSTER_NAME"
echo "Region:     $REGION"
echo "Local Port: $LOCAL_PORT"
echo "=========================================="
echo ""

# kubeconfigを取得
echo "1. Fetching kubeconfig from EKS..."
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

# クラスタARNを取得
echo ""
echo "2. Finding cluster ARN..."
CLUSTER_ARN=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"arn:aws:eks:${REGION}:*:cluster/${CLUSTER_NAME}\")].name}" 2>/dev/null || true)

if [ -z "$CLUSTER_ARN" ]; then
  # 別の方法でARNを取得
  CLUSTER_ARN=$(kubectl config get-clusters | grep "$CLUSTER_NAME" | head -1)
fi

if [ -z "$CLUSTER_ARN" ]; then
  echo "Error: Could not find cluster ARN for $CLUSTER_NAME"
  exit 1
fi

echo "   Cluster ARN: $CLUSTER_ARN"

# serverをlocalhost:6443に変更
echo ""
echo "3. Setting server to localhost:$LOCAL_PORT..."
kubectl config set-cluster "$CLUSTER_ARN" --server="https://localhost:$LOCAL_PORT"

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Run './scripts/k8s-tunnel.sh' in another terminal"
echo "  2. Run 'pm2 restart aws-resource-monitor'"
echo "  3. Open http://localhost:8001/k8s"
echo ""
