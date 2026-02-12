# ===========================================
# EKS Outputs
# ===========================================

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks_cluster.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint (Private)"
  value       = module.eks_cluster.cluster_endpoint
}

output "cluster_oidc_provider_arn" {
  description = "EKS OIDC provider ARN"
  value       = module.eks_cluster.oidc_provider_arn
}

output "cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = module.eks_cluster.cluster_security_group_id
}

# ===========================================
# VPC Outputs
# ===========================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnets" {
  description = "Public subnet IDs (ALB / NAT)"
  value       = module.vpc.public_subnets
}

output "private_subnets" {
  description = "Private subnet IDs (EKS Node / Bastion)"
  value       = module.vpc.private_subnets
}

output "database_subnets" {
  description = "Database subnet IDs (RDS / ElastiCache)"
  value       = module.vpc.database_subnets
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = module.vpc.natgw_ids
}

# ===========================================
# Security Outputs
# ===========================================

output "kms_key_arn" {
  description = "KMS Key ARN for encryption"
  value       = aws_kms_key.eks_encryption.arn
}

output "kms_key_id" {
  description = "KMS Key ID"
  value       = aws_kms_key.eks_encryption.key_id
}

output "alb_security_group_id" {
  description = "ALB Security Group ID"
  value       = aws_security_group.alb.id
}

output "vpc_endpoints_security_group_id" {
  description = "VPC Endpoints Security Group ID"
  value       = aws_security_group.vpce.id
}

# ===========================================
# ECR Outputs（shared から参照）
# ===========================================

output "ecr_backend_url" {
  description = "ECR repository URL for Backend"
  value       = data.aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "ECR repository URL for Frontend"
  value       = data.aws_ecr_repository.frontend.repository_url
}

output "ecr_mlops_pipeline_url" {
  description = "ECR Public repository URL for MLOps Pipeline"
  value       = try(data.terraform_remote_state.shared.outputs.ecr_public_repository_urls["mlops-pipeline"], null)
}

# ===========================================
# IRSA Outputs
# ===========================================

output "workload_irsa_role_arn" {
  description = "IAM Role ARN for workloads (Hono/ETL/etc)"
  value       = module.irsa_workload.iam_role_arn
}

output "lb_controller_role_arn" {
  description = "AWS Load Balancer Controller IAM Role ARN"
  value       = module.irsa_lb_controller.iam_role_arn
}

output "ebs_csi_role_arn" {
  description = "EBS CSI Driver IAM Role ARN"
  value       = module.irsa_ebs_csi.iam_role_arn
}

# ===========================================
# S3 Outputs
# ===========================================

output "s3_bucket_name" {
  description = "S3 bucket name for data"
  value       = aws_s3_bucket.data.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.data.arn
}

# ===========================================
# Logging Outputs（Firehose は shared から参照）
# ===========================================

output "firehose_stream_name" {
  description = "Firehose delivery stream name for access logs"
  value       = data.aws_kinesis_firehose_delivery_stream.app_logs.name
}

output "firehose_stream_arn" {
  description = "Firehose delivery stream ARN"
  value       = data.aws_kinesis_firehose_delivery_stream.app_logs.arn
}

output "error_log_group_name" {
  description = "CloudWatch Log Group name for error logs"
  value       = aws_cloudwatch_log_group.app_errors.name
}

output "vpc_flow_logs_group_name" {
  description = "CloudWatch Log Group name for VPC Flow Logs"
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
}

# ===========================================
# Utility Outputs
# ===========================================

output "region" {
  description = "AWS region"
  value       = local.region
}

output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

# ===========================================
# Bastion Outputs
# ===========================================

output "bastion_instance_id" {
  description = "Bastion EC2 instance ID"
  value       = aws_instance.bastion.id
}

output "bastion_private_ip" {
  description = "Bastion private IP address"
  value       = aws_instance.bastion.private_ip
}

output "bastion_connect_command" {
  description = "Command to connect to bastion via SSM"
  value       = "aws ssm start-session --target ${aws_instance.bastion.id} --region ${local.region}"
}

output "bastion_eks_setup_command" {
  description = "Command to setup kubectl on bastion"
  value       = "aws eks update-kubeconfig --region ${local.region} --name ${local.cluster_name}"
}

# ===========================================
# Karpenter Outputs
# ===========================================

output "karpenter_iam_role_arn" {
  description = "Karpenter IAM Role ARN"
  value       = module.karpenter.iam_role_arn
}

output "karpenter_node_role_name" {
  description = "Karpenter Node IAM Role Name"
  value       = module.karpenter.node_iam_role_name
}

output "karpenter_queue_name" {
  description = "Karpenter SQS Queue Name"
  value       = module.karpenter.queue_name
}

# ===========================================
# Environment Config for Applications
# ===========================================

output "app_env_config" {
  description = "Environment variables for app"
  value = {
    LOG_MODE             = "firehose"
    FIREHOSE_STREAM_NAME = data.aws_kinesis_firehose_delivery_stream.app_logs.name
    ERROR_LOG_GROUP      = aws_cloudwatch_log_group.app_errors.name
    AWS_REGION           = local.region
  }
}

# ===========================================
# ALB / Route53 Outputs
# ===========================================

output "api_alb_dns_name" {
  description = "API ALB DNS name"
  value       = aws_lb.api_main.dns_name
}

output "api_url" {
  description = "API URL"
  value       = "https://${local.api_fqdn}"
}

output "wildcard_acm_certificate_arn" {
  description = "Wildcard ACM certificate ARN (*.tk-k8s.com)"
  value       = aws_acm_certificate.wildcard.arn
}
