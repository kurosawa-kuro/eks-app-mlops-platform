# ===========================================
# Ops Gateway / Bastion Host（SSM Only）
# ===========================================
#
# 役割:
# - EKS Private Endpoint への kubectl アクセス
# - 運用ツール（Prometheus / Loki / Grafana / ArgoCD 等）
# - SSH 禁止 → SSM Session Manager のみ許可
#
# 配置:
# - Private Subnet
# - Public IP なし
# - NAT Gateway 経由でインターネットアクセス
#
# ===========================================

# ===========================================
# Amazon Linux 2023 AMI（Full版のみ）
# ===========================================
#
# 重要: Minimal AMI は使用禁止
#
# 理由:
#   - Minimal AMI（al2023-ami-minimal-*）には SSM Agent が含まれていない
#   - Private Subnet + SSM Only 構成では SSM Agent が必須
#   - SSM Agent がないと踏み台に接続不可 → EKS 運用が完全に詰む
#
# Full AMI の利点:
#   - SSM Agent プリインストール済み
#   - CloudWatch Agent 対応
#   - systemd 完全版
#
# パターン説明:
#   - "al2023-ami-2023.*-x86_64" → Full AMI のみマッチ
#   - "al2023-ami-*-x86_64"      → Minimal も含まれる（危険）
#
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"] # Full AMI のみ（minimal を除外）
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Bastion Host
resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.bastion_instance_type
  subnet_id              = module.vpc.private_subnets[0]
  iam_instance_profile   = aws_iam_instance_profile.bastion.name
  vpc_security_group_ids = [aws_security_group.bastion.id]

  # Public IP なし（SSM経由のみアクセス）
  associate_public_ip_address = false

  # EBS暗号化
  root_block_device {
    volume_size           = var.bastion_volume_size
    volume_type           = "gp3"
    encrypted             = true
    kms_key_id            = aws_kms_key.eks_encryption.arn
    delete_on_termination = true

    tags = merge(local.common_tags, {
      Name = "${local.names.bastion}-root"
    })
  }

  # メタデータサービス v2 必須（セキュリティ強化）
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 必須
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # User Data: kubectl / helm / AWS CLI インストール
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -ex

    # システムアップデート
    dnf update -y

    # SSM Agent インストール（フォールバック）
    # Full AMI には含まれているが、念のため明示的にインストール
    # ※ 既にインストール済みの場合はスキップされる
    dnf install -y amazon-ssm-agent || true
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent

    # 必要なツールをインストール
    dnf install -y git jq tar gzip unzip

    # kubectl インストール (EKS 1.29 対応バージョン)
    KUBECTL_VERSION="v1.29.12"
    curl -fLO "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl" || \
      curl -fLO "https://s3.us-west-2.amazonaws.com/amazon-eks/1.29.12/2025-01-07/bin/linux/amd64/kubectl"
    chmod +x kubectl
    mv kubectl /usr/local/bin/
    kubectl version --client || echo "kubectl install warning"

    # helm インストール
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

    # AWS CLI v2 インストール（最新版）
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install --update
    rm -rf aws awscliv2.zip

    # eksctl インストール
    ARCH=amd64
    PLATFORM=$(uname -s)_$ARCH
    curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_$PLATFORM.tar.gz"
    tar -xzf eksctl_$PLATFORM.tar.gz -C /usr/local/bin
    rm eksctl_$PLATFORM.tar.gz

    # k9s インストール
    curl -sLO "https://github.com/derailed/k9s/releases/latest/download/k9s_Linux_amd64.tar.gz"
    tar -xzf k9s_Linux_amd64.tar.gz -C /usr/local/bin k9s
    rm k9s_Linux_amd64.tar.gz

    # kubectx / kubens インストール
    git clone https://github.com/ahmetb/kubectx /opt/kubectx
    ln -s /opt/kubectx/kubectx /usr/local/bin/kubectx
    ln -s /opt/kubectx/kubens /usr/local/bin/kubens

    # make インストール
    dnf install -y make

    # Node.js 20.x インストール
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    node --version || echo "nodejs install warning"

    # Docker インストール
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user
    usermod -aG docker ssm-user || true

    # ArgoCD CLI インストール
    curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
    chmod +x /usr/local/bin/argocd
    argocd version --client || echo "argocd install warning"

    # EKS クラスタ設定（ssm-userとec2-user用）
    for USER_HOME in /root /home/ec2-user /home/ssm-user; do
      mkdir -p $USER_HOME/.kube
      cat > $USER_HOME/.kube/config <<'KUBECONFIG'
    # Run: aws eks update-kubeconfig --region ${var.region} --name ${var.cluster_name}
    KUBECONFIG
    done

    # .kube ディレクトリの所有者を適切に設定
    chown -R ec2-user:ec2-user /home/ec2-user/.kube
    chown -R ssm-user:ssm-user /home/ssm-user/.kube 2>/dev/null || true

    # 完了メッセージ
    echo "Bastion setup completed at $(date)" >> /var/log/bastion-setup.log
  EOF
  )

  tags = merge(local.common_tags, {
    Name = local.names.bastion
    Role = "OpsGateway"
  })

  lifecycle {
    ignore_changes = [ami] # AMI更新時の再作成を防止
  }
}

# ===========================================
# SSM Session Manager 設定
# ===========================================
# デフォルトで ec2-user として接続（root ではなく）

resource "aws_ssm_document" "ssm_prefs" {
  name            = "SSM-SessionManagerRunShell"
  document_type   = "Session"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "1.0"
    description   = "Session Manager Settings"
    sessionType   = "Standard_Stream"
    inputs = {
      runAsEnabled     = true
      runAsDefaultUser = "ec2-user"
      shellProfile = {
        linux = "cd ~ && bash -l"
      }
    }
  })

  tags = local.common_tags
}

# ===========================================
# EKS Access Entry（Bastion用）
# ===========================================

# Bastion の IAM Role に EKS クラスタアクセス権限を付与
resource "aws_eks_access_entry" "bastion" {
  cluster_name  = module.eks_cluster.cluster_name
  principal_arn = aws_iam_role.bastion.arn
  type          = "STANDARD"

  tags = local.common_tags
}

resource "aws_eks_access_policy_association" "bastion" {
  cluster_name  = module.eks_cluster.cluster_name
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
  principal_arn = aws_iam_role.bastion.arn

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.bastion]
}

# ===========================================
# Outputs -> 90_outputs.tf に移動
# ===========================================
