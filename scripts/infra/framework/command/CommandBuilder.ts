/**
 * CommandBuilder - builds shell command sequences for SSM.
 */

export const CommandBuilder = {
  preamble(): string[] {
    return ['set -e', 'export HOME=/home/ec2-user', 'cd /tmp', ''];
  },
  installKubectl(version = 'v1.29.12'): string[] {
    return [
      'echo "=== Checking/Installing kubectl ==="',
      'if ! command -v kubectl &> /dev/null; then',
      `  curl -fLO "https://dl.k8s.io/release/${version}/bin/linux/amd64/kubectl"`,
      '  chmod +x kubectl && mv kubectl /usr/local/bin/',
      'fi',
      'kubectl version --client --short 2>/dev/null || kubectl version --client',
      '',
    ];
  },
  installHelm(): string[] {
    return [
      'echo "=== Checking/Installing helm ==="',
      'if ! command -v helm &> /dev/null; then',
      '  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash',
      'fi',
      'helm version --short',
      '',
    ];
  },
  setupKubeconfig(region: string, clusterName: string): string[] {
    return [
      'echo "=== Setting up kubeconfig ==="',
      `sudo -u ec2-user aws eks update-kubeconfig --region ${region} --name ${clusterName}`,
      '',
    ];
  },
  join(sections: string[][]): string {
    return sections.flat().join('\n');
  },
};
