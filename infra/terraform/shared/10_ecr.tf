# ===========================================
# Shared ECR Repositories
# ===========================================
# These repositories are shared across all environments (staging/prod)
# Images are tagged with environment/version for separation
# ===========================================

# ---------------------------------------------
# Private ECR Repositories
# ---------------------------------------------

resource "aws_ecr_repository" "private" {
  for_each = var.ecr_repositories

  name                 = each.key
  image_tag_mutability = each.value.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = each.value.scan_on_push
  }

  # Use AES256 for existing repos (default), KMS for new repos causes recreation
  encryption_configuration {
    encryption_type = "AES256"
  }

  # Prevent recreation of existing repos due to encryption changes
  lifecycle {
    ignore_changes = [encryption_configuration]
  }

  tags = merge(local.common_tags, {
    Name = each.key
  })
}

# Lifecycle policy for each repository
resource "aws_ecr_lifecycle_policy" "private" {
  for_each   = var.ecr_repositories
  repository = aws_ecr_repository.private[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${each.value.max_image_count} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = each.value.max_image_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ---------------------------------------------
# Public ECR Repositories (us-east-1)
# ---------------------------------------------

resource "aws_ecrpublic_repository" "public" {
  provider = aws.us_east_1

  for_each        = toset(var.ecr_public_repositories)
  repository_name = each.key

  catalog_data {
    about_text        = "${each.key} container image"
    architectures     = ["x86-64", "ARM 64"]
    operating_systems = ["Linux"]
  }

  tags = merge(local.common_tags, {
    Name = each.key
  })
}
