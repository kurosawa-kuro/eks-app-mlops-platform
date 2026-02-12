# ===========================================
# Logging Infrastructure（本番構成）
# ===========================================
#
# 構成:
#   - Firehose: shared/ で管理（data source で参照）
#   - CloudWatch Logs: 環境固有（ここで管理）
#   - VPC Flow Logs: main.tf で定義
#
# ===========================================

# ===========================================
# Firehose Data Source（shared から参照）
# ===========================================

data "aws_kinesis_firehose_delivery_stream" "app_logs" {
  name = "app-log-stream"
}

# ===========================================
# CloudWatch Log Groups（環境固有）
# ===========================================

# Error logs (500 errors)
resource "aws_cloudwatch_log_group" "app_errors" {
  name              = local.names.log_app_errors
  retention_in_days = 90
  kms_key_id        = aws_kms_key.eks_encryption.arn

  tags = merge(local.common_tags, {
    Purpose = "error-logging"
  })
}

# EKS Control Plane logs are managed by EKS module
# See: cluster_enabled_log_types in main.tf
