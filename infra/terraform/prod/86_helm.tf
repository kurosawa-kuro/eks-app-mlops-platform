# ===========================================
# Helm Releases（Private EKS用）
# ===========================================
#
# 注意: Private EKSではローカルからKubernetes APIにアクセスできないため、
# Helmリソースは踏み台（Bastion）から手動でインストールする必要があります。
#
# インストール手順:
#   1. 踏み台に接続: aws ssm start-session --target <bastion-instance-id>
#   2. kubeconfig設定: aws eks update-kubeconfig --region ap-northeast-1 --name prod-eks-cluster
#   3. 以下のHelmコマンドを実行
#
# ===========================================

# AWS Load Balancer Controller
# helm repo add eks https://aws.github.io/eks-charts
# helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
#   -n kube-system \
#   --set clusterName=prod-eks-cluster \
#   --set serviceAccount.create=true \
#   --set serviceAccount.name=aws-load-balancer-controller \
#   --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<lb_controller_role_arn>

# Karpenter
# helm install karpenter oci://public.ecr.aws/karpenter/karpenter \
#   --version 1.1.0 \
#   -n karpenter --create-namespace \
#   --set settings.clusterName=prod-eks-cluster \
#   --set settings.clusterEndpoint=<cluster_endpoint> \
#   --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<karpenter_iam_role_arn> \
#   --set settings.interruptionQueue=<karpenter_queue_name>

# NVIDIA Device Plugin (GPUノード用)
# helm repo add nvdp https://nvidia.github.io/k8s-device-plugin
# helm install nvidia-device-plugin nvdp/nvidia-device-plugin \
#   -n kube-system \
#   --set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].key=karpenter.k8s.aws/instance-gpu-count \
#   --set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].operator=Gt \
#   --set affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values[0]="0"
