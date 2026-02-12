# ===========================================
# Security Groups
# ===========================================

# -------------------------------------------
# VPC Endpoints用 Security Group
# -------------------------------------------
resource "aws_security_group" "vpce" {
  name        = local.names.sg_vpce
  description = "Security group for VPC endpoints"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = local.names.sg_vpce
  })
}

# -------------------------------------------
# ALB Security Group
# -------------------------------------------
resource "aws_security_group" "alb" {
  name        = local.names.sg_alb
  description = "Security group for Application Load Balancer"
  vpc_id      = module.vpc.vpc_id

  # HTTP（リダイレクト用）
  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = local.names.sg_alb
  })
}

# -------------------------------------------
# EKS Nodes Security Group（ALBからの通信許可）
# -------------------------------------------
resource "aws_security_group" "eks_nodes" {
  name        = local.names.sg_eks
  description = "Additional security group for EKS nodes - allows ALB traffic"
  vpc_id      = module.vpc.vpc_id

  # ALB → Node（全ポート許可 - target-type: ip用）
  ingress {
    description     = "Allow ALB to Node (all ports for target-type ip)"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  tags = merge(local.common_tags, {
    Name = local.names.sg_eks
  })
}

# -------------------------------------------
# Bastion Security Group（SSM Only - Inbound不要）
# -------------------------------------------
resource "aws_security_group" "bastion" {
  name        = local.names.sg_bstn
  description = "Security group for Bastion host - SSM only, no SSH"
  vpc_id      = module.vpc.vpc_id

  # Inbound: なし（SSM Session Managerのみ使用）

  # Outbound: 全て許可（NAT経由でインターネットアクセス）
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = local.names.sg_bstn
  })
}

# -------------------------------------------
# Bastion → EKS API アクセス許可
# -------------------------------------------
# Private EKS では Bastion からのみ kubectl アクセス可能
# EKS Cluster Security Group に Bastion からの 443 を許可
resource "aws_security_group_rule" "bastion_to_eks_api" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  security_group_id        = module.eks_cluster.cluster_security_group_id
  source_security_group_id = aws_security_group.bastion.id
  description              = "Allow Bastion to EKS API Server"
}

# -------------------------------------------
# EKS Node -> NodePort アクセス許可（ALBから）
# -------------------------------------------

# Backend API NodePort
resource "aws_security_group_rule" "alb_to_nodeport_api" {
  type                     = "ingress"
  from_port                = var.api_nodeport
  to_port                  = var.api_nodeport
  protocol                 = "tcp"
  security_group_id        = module.eks_cluster.node_security_group_id
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow ALB to Backend API NodePort"
}

# Frontend NodePort
resource "aws_security_group_rule" "alb_to_nodeport_frontend" {
  type                     = "ingress"
  from_port                = var.frontend_nodeport
  to_port                  = var.frontend_nodeport
  protocol                 = "tcp"
  security_group_id        = module.eks_cluster.node_security_group_id
  source_security_group_id = aws_security_group.alb.id
  description              = "Allow ALB to Frontend NodePort"
}
