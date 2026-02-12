# ===========================================
# EKS Cluster（Private Endpoint Only）
# ===========================================

module "eks_cluster" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  # 既存クラスタとの互換性維持（再作成防止）
  bootstrap_self_managed_addons = false

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets # Private Subnetのみ

  # Private Endpoint Only（本番必須仕様）
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = false

  # Secrets暗号化（KMS）
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks_encryption.arn
    resources        = ["secrets"]
  }

  # クラスタ作成者に管理者権限を付与
  enable_cluster_creator_admin_permissions = true

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    default = {
      name           = "default-node-group"
      instance_types = [var.node_instance_type]

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      # 本番はOn-Demand
      capacity_type = "ON_DEMAND"

      # Private Subnetのみ
      subnet_ids = module.vpc.private_subnets

      # EBS暗号化
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 50
            volume_type           = "gp3"
            encrypted             = true
            kms_key_id            = aws_kms_key.eks_encryption.arn
            delete_on_termination = true
          }
        }
      }

      # SSM Agent用ポリシー + アプリワークロード用ポリシー
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        WorkloadPolicy               = aws_iam_policy.workload.arn
      }

      # EC2インスタンスのNameタグ
      tags = {
        Name = "prod-eks-worker-app"
      }
    }
  }

  # Control Plane Logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  # EKS アドオン
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.irsa_ebs_csi.iam_role_arn
    }
  }

  # Karpenter用タグ
  node_security_group_tags = {
    "karpenter.sh/discovery" = var.cluster_name
  }

  # 追加Security Group（ALB通信用）
  cluster_additional_security_group_ids = [aws_security_group.eks_nodes.id]

  tags = local.common_tags
}

# ===========================================
# EBS CSI Driver IRSA
# ===========================================

module "irsa_ebs_csi" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = local.names.role_ebs_csi
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.common_tags
}

# ===========================================
# AWS Load Balancer Controller IRSA
# ===========================================

module "irsa_lb_controller" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = local.names.role_lb_ctrl

  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.common_tags
}

# ===========================================
# AWS Load Balancer Controller Helm Release
# ===========================================
#
# Private EKSのため、Helmは踏み台から手動インストール
# 詳細は helm.tf を参照
#
# 踏み台で実行:
#   helm repo add eks https://aws.github.io/eks-charts
#   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
#     -n kube-system \
#     --set clusterName=${var.cluster_name} \
#     --set serviceAccount.create=true \
#     --set serviceAccount.name=aws-load-balancer-controller \
#     --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=${module.irsa_lb_controller.iam_role_arn} \
#     --set vpcId=${module.vpc.vpc_id}
