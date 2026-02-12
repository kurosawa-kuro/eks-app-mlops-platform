# ===========================================
# Shared Infrastructure Outputs
# ===========================================
# These outputs are used by prod/staging via data sources
# or terraform_remote_state
# ===========================================

# ---------------------------------------------
# ECR - Private Repositories
# ---------------------------------------------

output "ecr_repository_urls" {
  description = "Map of ECR repository names to URLs"
  value       = { for k, v in aws_ecr_repository.private : k => v.repository_url }
}

output "ecr_repository_arns" {
  description = "Map of ECR repository names to ARNs"
  value       = { for k, v in aws_ecr_repository.private : k => v.arn }
}

# ---------------------------------------------
# ECR - Public Repositories
# ---------------------------------------------

output "ecr_public_repository_urls" {
  description = "Map of public ECR repository names to URLs"
  value       = { for k, v in aws_ecrpublic_repository.public : k => v.repository_uri }
}

# ---------------------------------------------
# S3
# ---------------------------------------------

output "logs_bucket_name" {
  description = "S3 logs bucket name"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "S3 logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

# ---------------------------------------------
# Firehose
# ---------------------------------------------

output "firehose_stream_arns" {
  description = "Map of Firehose stream names to ARNs"
  value       = { for k, v in aws_kinesis_firehose_delivery_stream.log_delivery : k => v.arn }
}

output "firehose_stream_names" {
  description = "List of Firehose stream names"
  value       = [for k, v in aws_kinesis_firehose_delivery_stream.log_delivery : v.name]
}

# ---------------------------------------------
# IAM
# ---------------------------------------------

output "firehose_role_arn" {
  description = "Firehose IAM role ARN"
  value       = aws_iam_role.firehose_delivery.arn
}

# ---------------------------------------------
# Summary for Reference
# ---------------------------------------------

output "summary" {
  description = "Summary of shared resources for environment reference"
  value = {
    ecr_repos = {
      backend  = try(aws_ecr_repository.private["app-backend"].repository_url, null)
      frontend = try(aws_ecr_repository.private["app-frontend"].repository_url, null)
    }
    ecr_public = {
      mlops_pipeline = try(aws_ecrpublic_repository.public["mlops-pipeline"].repository_uri, null)
    }
    s3 = {
      logs_bucket = aws_s3_bucket.logs.id
    }
    firehose = {
      app_logs = try(aws_kinesis_firehose_delivery_stream.log_delivery["app-log-stream"].name, null)
    }
  }
}
