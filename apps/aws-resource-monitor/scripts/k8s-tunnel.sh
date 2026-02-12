#!/bin/bash
# EKS API へのSSMポートフォワード（Bastion経由）
# 設定は k8s-config.json から読み込み

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/k8s-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file not found: $CONFIG_FILE"
  exit 1
fi

# jqで設定読み込み
BASTION_INSTANCE_ID=$(jq -r '.bastionInstanceId' "$CONFIG_FILE")
EKS_ENDPOINT=$(jq -r '.eksEndpoint' "$CONFIG_FILE")
REGION=$(jq -r '.region' "$CONFIG_FILE")
LOCAL_PORT=$(jq -r '.localPort' "$CONFIG_FILE")

echo "=========================================="
echo "EKS API SSM Port Forward"
echo "=========================================="
echo "Bastion:    $BASTION_INSTANCE_ID"
echo "EKS:        $EKS_ENDPOINT"
echo "Local Port: $LOCAL_PORT"
echo "Region:     $REGION"
echo "=========================================="
echo ""
echo "Starting SSM session..."
echo "Press Ctrl+C to stop"
echo ""

aws ssm start-session \
  --target "$BASTION_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$EKS_ENDPOINT\"],\"portNumber\":[\"443\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
  --region "$REGION"
