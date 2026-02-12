# ===========================================
# Karpenter - 自動スケーリング（本番構成）
# ===========================================
#
# Private EKSのため、Helm/kubectl manifestは踏み台から手動インストール
# 詳細は helm.tf を参照
#

# Karpenter IAM Role + Instance Profile + SQS
module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "~> 20.0"

  cluster_name = module.eks_cluster.cluster_name

  # IRSA 設定
  enable_irsa                     = true
  irsa_oidc_provider_arn          = module.eks_cluster.oidc_provider_arn
  irsa_namespace_service_accounts = ["karpenter:karpenter"]

  # Karpenter ノード用 IAM Role / Instance Profile
  create_node_iam_role          = true
  node_iam_role_use_name_prefix = false
  node_iam_role_name            = "KarpenterNodeRole-${var.cluster_name}"

  # Karpenter ノードに必要なポリシー
  node_iam_role_additional_policies = {
    AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }

  # SQS (Spot 中断通知用)
  enable_spot_termination = true

  tags = local.common_tags
}

# ===========================================
# Karpenter Helm & Manifests（踏み台から実行）
# ===========================================
#
# 1. Karpenter Helm Install:
#
#   helm install karpenter oci://public.ecr.aws/karpenter/karpenter \
#     --version 1.1.0 \
#     -n karpenter --create-namespace \
#     --set settings.clusterName=prod-eks-cluster \
#     --set settings.clusterEndpoint=<CLUSTER_ENDPOINT> \
#     --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<KARPENTER_IAM_ROLE_ARN> \
#     --set settings.interruptionQueue=<KARPENTER_QUEUE_NAME>
#
# 2. NodePool (CPU):
#
#   kubectl apply -f - <<EOF
#   apiVersion: karpenter.sh/v1
#   kind: NodePool
#   metadata:
#     name: default
#   spec:
#     template:
#       spec:
#         requirements:
#           - key: "karpenter.sh/capacity-type"
#             operator: In
#             values: ["on-demand", "spot"]
#           - key: "kubernetes.io/arch"
#             operator: In
#             values: ["amd64"]
#           - key: "node.kubernetes.io/instance-type"
#             operator: In
#             values: ["t3.medium", "t3.large", "t3a.medium", "t3a.large", "m5.large", "m5a.large"]
#         nodeClassRef:
#           group: karpenter.k8s.aws
#           kind: EC2NodeClass
#           name: default
#     limits:
#       cpu: 100
#       memory: 200Gi
#     disruption:
#       consolidationPolicy: WhenEmptyOrUnderutilized
#       consolidateAfter: 1m
#   EOF
#
# 3. EC2NodeClass (Default):
#
#   kubectl apply -f - <<EOF
#   apiVersion: karpenter.k8s.aws/v1
#   kind: EC2NodeClass
#   metadata:
#     name: default
#   spec:
#     amiSelectorTerms:
#       - alias: al2023@latest
#     subnetSelectorTerms:
#       - tags:
#           kubernetes.io/role/internal-elb: "1"
#     securityGroupSelectorTerms:
#       - tags:
#           karpenter.sh/discovery: prod-eks-cluster
#     role: KarpenterNodeRole-prod-eks-cluster
#     blockDeviceMappings:
#       - deviceName: /dev/xvda
#         ebs:
#           volumeSize: 50Gi
#           volumeType: gp3
#           encrypted: true
#           kmsKeyId: <KMS_KEY_ARN>
#           deleteOnTermination: true
#     tags:
#       Environment: production
#       Project: prod-eks-cluster
#       ManagedBy: Karpenter
#       karpenter.sh/discovery: prod-eks-cluster
#   EOF
#
# 4. GPU NodePool & EC2NodeClass (オプション):
#    詳細は helm.tf を参照
#

# ===========================================
# Outputs -> 90_outputs.tf に移動
# ===========================================
