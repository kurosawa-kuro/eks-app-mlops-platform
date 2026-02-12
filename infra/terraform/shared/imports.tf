# ===========================================
# Import blocks for idempotency
# ===========================================
# These blocks allow `terraform apply` to work on existing resources
# without manual import commands.
#
# Usage: terraform apply (automatically imports if resources exist)
# ===========================================

# ---------------------------------------------
# ECR Private Repositories
# ---------------------------------------------

import {
  for_each = var.ecr_repositories
  to       = aws_ecr_repository.private[each.key]
  id       = each.key
}

# ---------------------------------------------
# ECR Public Repository (mlops-pipeline)
# ---------------------------------------------

import {
  for_each = toset(var.ecr_public_repositories)
  to       = aws_ecrpublic_repository.public[each.key]
  id       = each.key
}

# ---------------------------------------------
# S3 Logs Bucket
# ---------------------------------------------

import {
  to = aws_s3_bucket.logs
  id = var.logs_bucket_name
}

# ---------------------------------------------
# IAM Role for Firehose
# ---------------------------------------------

import {
  to = aws_iam_role.firehose_delivery
  id = local.names.role_firehose
}
