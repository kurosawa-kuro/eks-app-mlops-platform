# ===========================================
# 基本設定
# ===========================================

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "k8s-ml-platform"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "prod-eks-cluster"
}

variable "cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.29"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# ===========================================
# ネットワーク設定
# ===========================================

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_ha_nat" {
  description = "Enable HA NAT Gateway (one per AZ). false = single NAT gateway"
  type        = bool
  default     = false # シングル構成
}

variable "flow_logs_retention_days" {
  description = "VPC Flow Logs retention period in days"
  type        = number
  default     = 90
}

# ===========================================
# EKS Node設定
# ===========================================

variable "node_instance_type" {
  description = "EC2 instance type for nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  description = "Desired number of nodes"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of nodes"
  type        = number
  default     = 5
}

# ===========================================
# 踏み台設定
# ===========================================

variable "bastion_instance_type" {
  description = "EC2 instance type for bastion host"
  type        = string
  default     = "t3.small"
}

variable "bastion_volume_size" {
  description = "EBS volume size for bastion host (GB)"
  type        = number
  default     = 50
}

# ===========================================
# タグ設定
# ===========================================

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "platform-team"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

# ===========================================
# Route53 / ACM 設定
# ===========================================

variable "root_domain" {
  description = "Root domain name (must exist in Route53)"
  type        = string
  default     = "tk-k8s.com"
}

variable "api_subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}

variable "api_nodeport" {
  description = "NodePort for API (backend) service"
  type        = number
  default     = 30080
}

variable "frontend_nodeport" {
  description = "NodePort for Frontend service"
  type        = number
  default     = 30000
}

# ===========================================
# Local Values -> locals.tf に移動
# ===========================================
