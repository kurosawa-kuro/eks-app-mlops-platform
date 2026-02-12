# ===========================================
# Local Values - Centralized Configuration
# ===========================================
#
# All project-wide values in one place.
# Change here, apply everywhere.
#
# ===========================================

locals {
  # -------------------------------------------
  # Project Identity
  # -------------------------------------------
  project = var.project_name # "k8s-ml-platform"
  env     = "prod"
  region  = var.region

  # -------------------------------------------
  # Naming Convention
  # -------------------------------------------
  # Format: {project}-{env}-{component}
  # Example: k8s-ml-platform-prod-vpc
  name_prefix  = "${local.project}-${local.env}"
  cluster_name = var.cluster_name # "prod-eks-cluster" (EKS専用)

  # -------------------------------------------
  # Domain / DNS
  # -------------------------------------------
  root_domain   = var.root_domain   # "tk-k8s.com"
  api_subdomain = var.api_subdomain # "api"
  api_fqdn      = "${local.api_subdomain}.${local.root_domain}"

  # -------------------------------------------
  # Network - CIDR Blocks
  # -------------------------------------------
  vpc_cidr = var.vpc_cidr # "10.0.0.0/16"

  # Subnet allocation:
  #   Public:   10.0.1-2.0/24   (ALB, NAT Gateway)
  #   Private:  10.0.11-12.0/24 (EKS Nodes, Bastion)
  #   Database: 10.0.21-22.0/24 (RDS, ElastiCache)
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets  = ["10.0.11.0/24", "10.0.12.0/24"]
  database_subnets = ["10.0.21.0/24", "10.0.22.0/24"]

  # -------------------------------------------
  # EKS Configuration
  # -------------------------------------------
  eks_version = var.cluster_version
  node_port   = var.api_nodeport # 30080

  # -------------------------------------------
  # Resource Names (Unified Naming Convention)
  # -------------------------------------------
  # All names follow: ${name_prefix}-{component}
  # Example: k8s-ml-platform-prod-vpc
  names = {
    # Network
    vpc     = "${local.name_prefix}-vpc"
    sg_vpce = "${local.name_prefix}-vpce-sg"
    sg_alb  = "${local.name_prefix}-alb-sg"
    sg_eks  = "${local.name_prefix}-eks-nodes-sg"
    sg_bstn = "${local.name_prefix}-bastion-sg"

    # ALB
    alb = "${local.name_prefix}-api-alb"
    tg  = "${local.name_prefix}-api-tg"

    # ACM / Route53
    cert = "${local.name_prefix}-api-cert"

    # S3
    s3_data = "${local.name_prefix}-data-${data.aws_caller_identity.current.account_id}"

    # KMS
    kms_alias = "alias/${local.name_prefix}"

    # IAM Roles
    role_vpc_flow = "${local.name_prefix}-vpc-flow-role"
    role_bastion  = "${local.name_prefix}-bastion-role"
    role_workload = "${local.name_prefix}-workload-role"
    role_ebs_csi  = "${local.name_prefix}-ebs-csi-role"
    role_lb_ctrl  = "${local.name_prefix}-lb-controller-role"

    # IAM Policies
    policy_bastion  = "${local.name_prefix}-bastion-policy"
    policy_workload = "${local.name_prefix}-workload-policy"

    # Instance Profile
    profile_bastion = "${local.name_prefix}-bastion-profile"

    # EC2
    bastion = "${local.name_prefix}-bastion"

    # CloudWatch Logs
    log_vpc_flow   = "/${local.project}/${local.env}/vpc-flow-logs"
    log_app_errors = "/${local.project}/${local.env}/app-errors"
  }

  # -------------------------------------------
  # Common Tags
  # -------------------------------------------
  common_tags = {
    Project     = local.project
    Environment = local.env
    Cluster     = local.cluster_name
    ManagedBy   = "Terraform"
    Owner       = var.owner
    CostCenter  = var.cost_center
  }

  # -------------------------------------------
  # Kubernetes Tags (for AWS resources)
  # -------------------------------------------
  k8s_cluster_tag = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  k8s_public_subnet_tags = merge(local.k8s_cluster_tag, {
    "kubernetes.io/role/elb" = 1
  })

  k8s_private_subnet_tags = merge(local.k8s_cluster_tag, {
    "kubernetes.io/role/internal-elb" = 1
    "karpenter.sh/discovery"          = local.cluster_name
  })

  # -------------------------------------------
  # VPC Endpoints List (Interface type)
  # -------------------------------------------
  vpc_interface_endpoints = [
    "ecr.api",
    "ecr.dkr",
    "kms",
    "logs",
    "sts",
    "ssm",
    "ssmmessages",
    "ec2messages",
  ]
}
