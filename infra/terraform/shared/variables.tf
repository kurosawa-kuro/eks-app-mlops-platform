# ===========================================
# Shared Infrastructure - Variables
# ===========================================

variable "region" {
  description = "AWS region for shared resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "k8s-ml-platform"
}

# ===========================================
# ECR Configuration
# ===========================================

variable "ecr_repositories" {
  description = "Map of ECR repositories to create"
  type = map(object({
    image_tag_mutability = string
    scan_on_push         = bool
    max_image_count      = number
  }))
  default = {
    "app-backend" = {
      image_tag_mutability = "IMMUTABLE"
      scan_on_push         = true
      max_image_count      = 30
    }
    "app-frontend" = {
      image_tag_mutability = "IMMUTABLE"
      scan_on_push         = true
      max_image_count      = 30
    }
  }
}

variable "ecr_public_repositories" {
  description = "List of public ECR repository names"
  type        = list(string)
  default     = ["mlops-pipeline"]
}

# ===========================================
# Firehose Configuration
# ===========================================

variable "firehose_streams" {
  description = "Map of Firehose streams to create"
  type = map(object({
    buffer_size     = number
    buffer_interval = number
    prefix          = string
  }))
  default = {
    "app-log-stream" = {
      buffer_size     = 64
      buffer_interval = 300
      prefix          = "app/"
    }
  }
}

# ===========================================
# S3 Configuration
# ===========================================

variable "logs_bucket_name" {
  description = "S3 bucket name for centralized logs"
  type        = string
  default     = "k8s-ml-platform-logs"
}

variable "logs_retention_days" {
  description = "Days to retain logs before transitioning to Glacier"
  type        = number
  default     = 90
}

variable "logs_glacier_days" {
  description = "Days to retain logs in Glacier before deletion"
  type        = number
  default     = 365
}

# ===========================================
# Common Tags -> locals.tf に移動
# ===========================================
