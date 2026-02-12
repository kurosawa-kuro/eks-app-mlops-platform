/**
 * GPUStackDeployer - deploys GPU/LLM infrastructure to EKS.
 *
 * Supports:
 *   - Karpenter installation via Helm
 *   - NVIDIA Device Plugin deployment
 *   - GPU NodePool + EC2NodeClass
 *   - LLM Stack (vLLM) deployment
 *   - Hono reconfiguration for LLM integration
 */

import { run as defaultRun } from '../../shell/index.js';
import { log as defaultLog } from '../../../framework/logging/index.js';
import type { SSMCommandRunner } from '../../aws/runtime/SSMCommandRunner.js';
import type { Logger } from '../../../framework/types.js';
import type { RunOptions } from '../../types.js';
import type { DeployResult } from './deployers-types.js';
import { c } from '../../../framework/logging/colors.js';

/** Configuration for GPU Stack deployment */
export interface GPUDeployerConfig {
  /** EKS cluster name */
  clusterName: string;
  /** AWS region */
  region: string;
  /** EKS cluster endpoint */
  clusterEndpoint: string;
  /** Karpenter IAM role ARN */
  karpenterRoleArn: string;
  /** Karpenter interruption queue name */
  karpenterQueueName: string;
  /** Karpenter version */
  karpenterVersion?: string;
  /** vLLM image */
  vllmImage?: string;
  /** LLM model ID */
  llmModel?: string;
  /** SSM runner for bastion-based deployments */
  bastionRunner: SSMCommandRunner;
  /** Suppress output */
  silent?: boolean;
}

/** Dependencies for GPUStackDeployer */
export interface GPUDeployerDependencies {
  run: (cmd: string, options?: RunOptions) => string | null;
  log: Logger;
}

const defaultDependencies: GPUDeployerDependencies = {
  run: defaultRun,
  log: defaultLog,
};

/** GPU status result */
export interface GPUStatus {
  karpenterInstalled: boolean;
  nvidiaPluginDeployed: boolean;
  gpuNodesCount: number;
  llmPodsCount: number;
}

/**
 * Deployer for GPU/LLM infrastructure.
 *
 * @example
 * const deployer = new GPUStackDeployer({
 *   clusterName: 'my-cluster',
 *   region: 'ap-northeast-1',
 *   clusterEndpoint: 'https://...',
 *   karpenterRoleArn: 'arn:aws:iam::xxx:role/karpenter',
 *   karpenterQueueName: 'my-queue',
 *   bastionRunner: ssmRunner,
 * });
 *
 * // Full deployment
 * await deployer.installKarpenter();
 * await deployer.deployNvidiaPlugin();
 * await deployer.deployGPUNodePool();
 * await deployer.deployLLMStack();
 * await deployer.redeployHono();
 */
export class GPUStackDeployer {
  private config: GPUDeployerConfig;
  private deps: GPUDeployerDependencies;

  constructor(config: GPUDeployerConfig, deps: Partial<GPUDeployerDependencies> = {}) {
    this.config = config;
    this.deps = { ...defaultDependencies, ...deps };
  }

  /**
   * Step 1: Install Karpenter via Helm.
   *
   * @returns Deployment result
   */
  async installKarpenter(): Promise<DeployResult> {
    const {
      clusterName, region, clusterEndpoint, karpenterRoleArn, karpenterQueueName,
      karpenterVersion = '1.1.0',
    } = this.config;

    if (!this.config.silent) {
      this.deps.log.phase(1, 'Install Karpenter');
    }

    if (!clusterEndpoint || !karpenterRoleArn) {
      if (!this.config.silent) this.deps.log.fail('Missing Terraform outputs');
      return { success: false, error: 'Missing Terraform outputs' };
    }

    // Check if Helm is installed, install if not
    const helmCheck = await this.execute(
      this.buildCmd(['which helm || echo "NOT_FOUND"']),
      'Helm check',
      60,
      true
    );

    if (helmCheck.output?.includes('NOT_FOUND')) {
      await this.execute(
        this.buildCmd(['curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash']),
        'Helm Install',
        120,
        true
      );
    }

    // Install Karpenter
    const escapedRoleArn = karpenterRoleArn.replace(/\//g, '\\/');
    const result = await this.execute(
      this.buildCmd([
        `helm list -n karpenter 2>/dev/null | grep -q karpenter && echo "ALREADY_INSTALLED" || ` +
        `helm install karpenter oci://public.ecr.aws/karpenter/karpenter --version ${karpenterVersion} ` +
        `-n karpenter --create-namespace --set settings.clusterName=${clusterName} ` +
        `--set settings.clusterEndpoint=${clusterEndpoint} --set serviceAccount.annotations.eks\\\\.amazonaws\\\\.com/role-arn=${escapedRoleArn} ` +
        `--set settings.interruptionQueue=${karpenterQueueName} --wait --timeout 5m`,
        'kubectl get pods -n karpenter',
      ]),
      'Karpenter',
      360,
      true
    );

    if (result.success && !this.config.silent) {
      this.deps.log.pass('Karpenter installed');
      console.log(c.dim(result.output || ''));
    } else if (!result.success && !this.config.silent) {
      this.deps.log.fail('Karpenter install failed');
    }

    return result;
  }

  /**
   * Step 2: Deploy NVIDIA Device Plugin.
   *
   * @returns Deployment result
   */
  async deployNvidiaPlugin(): Promise<DeployResult> {
    if (!this.config.silent) {
      this.deps.log.phase(2, 'NVIDIA Device Plugin');
    }

    const manifest = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: nvidia-device-plugin-daemonset
  namespace: kube-system
spec:
  selector:
    matchLabels:
      name: nvidia-device-plugin-ds
  template:
    metadata:
      labels:
        name: nvidia-device-plugin-ds
    spec:
      priorityClassName: system-node-critical
      tolerations:
        - operator: Exists
        - key: nvidia.com/gpu
          operator: Equal
          value: "true"
          effect: NoSchedule
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: karpenter.k8s.aws/instance-gpu-count
                    operator: Gt
                    values: ["0"]
      containers:
        - image: nvcr.io/nvidia/k8s-device-plugin:v0.16.2
          name: nvidia-device-plugin-ctr
          args: ["--fail-on-init-error=false"]
          volumeMounts:
            - name: device-plugin
              mountPath: /var/lib/kubelet/device-plugins
      volumes:
        - name: device-plugin
          hostPath:
            path: /var/lib/kubelet/device-plugins`;

    const result = await this.execute(
      this.buildCmd([`cat << 'EOF' | kubectl apply -f -\n${manifest}\nEOF`]),
      'NVIDIA Plugin',
      60,
      true
    );

    if (result.success && !this.config.silent) {
      this.deps.log.pass('NVIDIA Plugin deployed');
    }

    return result;
  }

  /**
   * Step 3: Deploy GPU NodePool + EC2NodeClass.
   *
   * @returns Deployment result
   */
  async deployGPUNodePool(): Promise<DeployResult> {
    const { clusterName } = this.config;

    if (!this.config.silent) {
      this.deps.log.phase(3, 'GPU NodePool + EC2NodeClass');
    }

    const ec2NodeClass = `apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: gpu
spec:
  amiSelectorTerms:
    - alias: al2@latest
  subnetSelectorTerms:
    - tags:
        kubernetes.io/role/internal-elb: "1"
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: ${clusterName}
  role: KarpenterNodeRole-${clusterName}
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 200Gi
        volumeType: gp3
        encrypted: true
  tags:
    Name: prod-eks-worker-ml-gpu
    Project: k8s-ml-platform
    Environment: prod`;

    const nodePool = `apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: gpu
spec:
  template:
    metadata:
      labels:
        workload: gpu
    spec:
      taints:
        - key: nvidia.com/gpu
          value: "true"
          effect: NoSchedule
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ["g5.xlarge", "g5.2xlarge", "g6.xlarge", "g6.2xlarge"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: gpu
  limits:
    cpu: 64
    memory: 256Gi
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 5m`;

    const result = await this.execute(
      this.buildCmd([
        `cat << 'EOF' | kubectl apply -f -\n${ec2NodeClass}\nEOF`,
        `cat << 'EOF' | kubectl apply -f -\n${nodePool}\nEOF`,
        'kubectl get nodepool; kubectl get ec2nodeclass',
      ]),
      'GPU NodePool',
      60,
      true
    );

    if (result.success && !this.config.silent) {
      this.deps.log.pass('GPU NodePool deployed');
      console.log(c.dim(result.output || ''));
    }

    return result;
  }

  /**
   * Step 4: Deploy LLM Stack (vLLM).
   *
   * @returns Deployment result
   */
  async deployLLMStack(): Promise<DeployResult> {
    const { llmModel = 'line-corporation/line-distilbert-base-japanese', vllmImage = 'vllm/vllm-openai:latest' } = this.config;

    if (!this.config.silent) {
      this.deps.log.phase(4, 'LLM Stack (vLLM)');
    }

    const deployment = `apiVersion: v1
kind: Namespace
metadata:
  name: llm
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: llm-config
  namespace: llm
data:
  LLM_MODEL_ID: "${llmModel}"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference
  namespace: llm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: llm-inference
  template:
    metadata:
      labels:
        app: llm-inference
    spec:
      tolerations:
        - key: nvidia.com/gpu
          operator: Equal
          value: "true"
          effect: NoSchedule
      containers:
        - name: vllm
          image: ${vllmImage}
          args: ["--model", "$(LLM_MODEL_ID)", "--host", "0.0.0.0", "--port", "8000", "--dtype", "auto", "--gpu-memory-utilization", "0.90"]
          envFrom:
            - configMapRef:
                name: llm-config
          ports:
            - containerPort: 8000
          resources:
            limits:
              nvidia.com/gpu: "1"
              memory: "24Gi"
            requests:
              nvidia.com/gpu: "1"
              memory: "12Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: llm-inference
  namespace: llm
spec:
  selector:
    app: llm-inference
  ports:
    - port: 8000
      targetPort: 8000`;

    const result = await this.execute(
      this.buildCmd([
        `cat << 'EOF' | kubectl apply -f -\n${deployment}\nEOF`,
        'kubectl get pods -n llm',
      ]),
      'LLM Stack',
      120,
      true
    );

    if (result.success && !this.config.silent) {
      this.deps.log.pass('LLM Stack deployed');
      this.deps.log.info('GPU node will be provisioned on-demand');
    }

    return result;
  }

  /**
   * Step 5: Redeploy Hono with LLM Config.
   *
   * @returns Deployment result
   */
  async redeployHono(): Promise<DeployResult> {
    if (!this.config.silent) {
      this.deps.log.phase(5, 'Redeploy Hono with LLM Config');
    }

    const configMap = `apiVersion: v1
kind: ConfigMap
metadata:
  name: hono-app-config
  namespace: app
data:
  PORT: "8000"
  NODE_ENV: "production"
  ENABLE_LLM_API: "true"
  LLM_INFERENCE_URL: "http://llm-inference.llm.svc.cluster.local:8000"`;

    const result = await this.execute(
      this.buildCmd([
        `cat << 'EOF' | kubectl apply -f -\n${configMap}\nEOF`,
        'kubectl rollout restart deployment/hono-app -n app',
        'sleep 30',
        'kubectl rollout status deployment/hono-app -n app --timeout=120s',
      ]),
      'Hono Redeploy',
      180,
      true
    );

    if (result.success && !this.config.silent) {
      this.deps.log.pass('Hono redeployed');
    }

    return result;
  }

  /**
   * Show GPU/LLM infrastructure status.
   *
   * @returns Deployment result with status in output
   */
  async getStatus(): Promise<DeployResult> {
    const result = await this.execute(
      this.buildCmd([
        'echo "=== Karpenter ==="; kubectl get pods -n karpenter 2>/dev/null || echo "(not installed)"',
        'echo ""; echo "=== NodePools ==="; kubectl get nodepool 2>/dev/null || echo "(none)"',
        'echo ""; echo "=== GPU Nodes ==="; kubectl get nodes -l workload=gpu 2>/dev/null || echo "(none)"',
        'echo ""; echo "=== LLM Pods ==="; kubectl get pods -n llm -o wide 2>/dev/null || echo "(none)"',
      ]),
      'Status',
      60,
      true
    );

    if (result.success) {
      console.log(result.output);
    }

    return result;
  }

  /**
   * Run all GPU deployment steps sequentially.
   *
   * @param waitBetweenSteps - Wait time between step 4 and 5 in ms
   * @returns Deployment result
   */
  async deployAll(waitBetweenSteps = 60000): Promise<DeployResult> {
    let result = await this.installKarpenter();
    if (!result.success) return result;

    result = await this.deployNvidiaPlugin();
    if (!result.success) return result;

    result = await this.deployGPUNodePool();
    if (!result.success) return result;

    result = await this.deployLLMStack();
    if (!result.success) return result;

    // Wait for GPU provisioning
    if (!this.config.silent) {
      this.deps.log.info(`Waiting ${waitBetweenSteps / 1000}s for GPU provisioning...`);
    }
    await new Promise(resolve => setTimeout(resolve, waitBetweenSteps));

    result = await this.redeployHono();
    if (!result.success) return result;

    await this.getStatus();

    return { success: true };
  }

  /**
   * Build a command with preamble and kubeconfig setup.
   */
  private buildCmd(commands: string[]): string {
    const { clusterName, region } = this.config;
    return [
      'set -e',
      'export HOME=/root',
      `aws eks update-kubeconfig --region ${region} --name ${clusterName}`,
      ...commands,
    ].join('\n');
  }

  /**
   * Execute a command.
   */
  private async execute(cmd: string, label: string, timeout = 60, silent = false): Promise<DeployResult> {
    const isSilent = silent || this.config.silent;

    try {
      const result = await this.config.bastionRunner.execute(cmd, {
        label,
        timeout,
        stream: !isSilent,
      });

      if (result.success) {
        return { success: true, output: result.output };
      } else {
        return { success: false, error: result.output };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  }
}
