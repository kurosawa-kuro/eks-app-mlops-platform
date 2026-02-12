# ===========================================
# Local Values - Shared Infrastructure
# ===========================================

locals {
  # -------------------------------------------
  # Project Identity
  # -------------------------------------------
  project     = var.project_name # "k8s-ml-platform"
  region      = var.region
  name_prefix = local.project # shared resources don't have env suffix

  # -------------------------------------------
  # Resource Names (Unified Naming Convention)
  # -------------------------------------------
  names = {
    # S3
    s3_logs = var.logs_bucket_name

    # IAM
    role_firehose   = "${local.name_prefix}-firehose-role"
    policy_firehose = "${local.name_prefix}-firehose-policy"

    # CloudWatch Logs
    log_firehose_prefix = "/aws/firehose"
  }

  # -------------------------------------------
  # Common Tags
  # -------------------------------------------
  common_tags = {
    Project   = local.project
    ManagedBy = "Terraform"
    Layer     = "shared"
  }
}
