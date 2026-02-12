# ===========================================
# Shared Infrastructure - Provider Configuration
# ===========================================
# This Terraform manages environment-independent resources:
# - ECR repositories
# - Kinesis Firehose (logging)
# - S3 log buckets
# - (Future) Route53, ACM, CloudTrail, GuardDuty
# ===========================================

terraform {
  required_version = ">= 1.0"

  # Local backend - state files isolated in state/ directory
  backend "local" {
    path = "state/terraform.tfstate"
  }

  # Remote backend (S3) - uncomment for production use
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "shared/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      ManagedBy = "Terraform"
      Layer     = "shared"
      Owner     = "platform-team"
    }
  }
}

# Public ECR requires us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      ManagedBy = "Terraform"
      Layer     = "shared"
      Owner     = "platform-team"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
