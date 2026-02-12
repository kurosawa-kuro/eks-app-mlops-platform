# ===========================================
# IRSA（IAM Roles for Service Accounts）
# 本番構成: 最小権限の原則
# ===========================================

# -------------------------------------------
# Workload用 IAM ポリシー
# -------------------------------------------

resource "aws_iam_policy" "workload" {
  name        = local.names.policy_workload
  description = "S3, CloudWatch Logs, and Firehose access for EKS workloads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.data.arn,
          "${aws_s3_bucket.data.arn}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogsAccess"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/${local.project}/${local.env}/*"
      },
      {
        Sid    = "FirehoseAccess"
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch",
          "firehose:DescribeDeliveryStream"
        ]
        Resource = [
          "arn:aws:firehose:${var.region}:${data.aws_caller_identity.current.account_id}:deliverystream/app-log-stream"
        ]
      },
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.eks_encryption.arn
      }
    ]
  })

  tags = local.common_tags
}

# -------------------------------------------
# Workload IRSA ロール
# -------------------------------------------

module "irsa_workload" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = local.names.role_workload

  oidc_providers = {
    main = {
      provider_arn = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = [
        "app:app-serviceaccount",
        "mlops:mlops-sa"
      ]
    }
  }

  role_policy_arns = {
    workload_policy = aws_iam_policy.workload.arn
  }

  tags = local.common_tags
}

# -------------------------------------------
# Bastion/OpsGateway用 IAM Role
# -------------------------------------------

resource "aws_iam_role" "bastion" {
  name = local.names.role_bastion

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

# SSM Session Manager用
resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  role       = aws_iam_role.bastion.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# EKS クラスタアクセス用 + S3 読み取り（マニフェスト取得用）+ KMS 復号
resource "aws_iam_policy" "bastion_eks_access" {
  name        = local.names.policy_bastion
  description = "EKS access, S3 read, and KMS decrypt for bastion host"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EKSDescribe"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3ReadManifests"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.data.arn,
          "${aws_s3_bucket.data.arn}/*"
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.eks_encryption.arn
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "bastion_eks_access" {
  role       = aws_iam_role.bastion.name
  policy_arn = aws_iam_policy.bastion_eks_access.arn
}

# Instance Profile
resource "aws_iam_instance_profile" "bastion" {
  name = local.names.profile_bastion
  role = aws_iam_role.bastion.name

  tags = local.common_tags
}
