/**
 * Tests for CommandBuilder class
 */
import { describe, it, expect } from 'vitest';
import { CommandBuilder } from '../../../framework/command/CommandBuilder.js';

describe('CommandBuilder', () => {
  it('preamble returns shell setup commands', () => {
    const result = CommandBuilder.preamble();
    expect(result).toContain('set -e');
    expect(result).toContain('export HOME=/home/ec2-user');
    expect(result).toContain('cd /tmp');
  });

  it('installKubectl returns installation script', () => {
    const result = CommandBuilder.installKubectl();
    expect(result.join('\n')).toContain('kubectl');
    expect(result.join('\n')).toContain('curl');
  });

  it('installKubectl uses custom version', () => {
    const result = CommandBuilder.installKubectl('v1.28.0');
    expect(result.join('\n')).toContain('v1.28.0');
  });

  it('installHelm returns installation script', () => {
    const result = CommandBuilder.installHelm();
    expect(result.join('\n')).toContain('helm');
    expect(result.join('\n')).toContain('get-helm-3');
  });

  it('setupKubeconfig returns kubeconfig commands', () => {
    const result = CommandBuilder.setupKubeconfig('ap-northeast-1', 'my-cluster');
    expect(result.join('\n')).toContain('ap-northeast-1');
    expect(result.join('\n')).toContain('my-cluster');
    expect(result.join('\n')).toContain('update-kubeconfig');
  });

  it('join concatenates command sections', () => {
    const sections = [
      ['echo "a"', 'echo "b"'],
      ['echo "c"'],
    ];
    const result = CommandBuilder.join(sections);
    expect(result).toBe('echo "a"\necho "b"\necho "c"');
  });
});
