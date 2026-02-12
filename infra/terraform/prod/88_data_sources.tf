# ===========================================
# ECR Data Sources（shared から参照）
# ===========================================
# ECR repositories are managed in ../shared/
# This file provides data source references for prod
# ===========================================

# ---------------------------------------------
# Private ECR Repositories
# ---------------------------------------------

data "aws_ecr_repository" "backend" {
  name = "app-backend"
}

data "aws_ecr_repository" "frontend" {
  name = "app-frontend"
}

# ---------------------------------------------
# Public ECR - Reference from shared/
# ---------------------------------------------
# aws_ecrpublic_repository has no data source
# Use terraform_remote_state or local reference

# Option 1: Remote State (when S3 backend is configured)
# data "terraform_remote_state" "shared" {
#   backend = "s3"
#   config = {
#     bucket = "your-terraform-state-bucket"
#     key    = "shared/terraform.tfstate"
#     region = "ap-northeast-1"
#   }
# }

# Option 2: Local State Reference
data "terraform_remote_state" "shared" {
  backend = "local"
  config = {
    path = "../shared/state/terraform.tfstate"
  }
}
