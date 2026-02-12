/**
 * SSMCommandRunner - executes commands on EC2 instances via AWS SSM.
 */

import { aws, sleep } from '../../shell/index.js';
import { log } from '../../../framework/logging/index.js';
import { c } from '../../../framework/logging/colors.js';
import { awsGetRegion } from '../api/core.js';
import { safeParseJson, SSMInstanceInfoSchema } from '../../types.js';
import type { SSMExecuteOptions, SSMExecuteResult } from '../../../framework/types.js';

export class SSMCommandRunner {
  instanceId: string;
  region: string;

  constructor(instanceId: string, region?: string) {
    this.instanceId = instanceId;
    this.region = region || awsGetRegion();
  }

  async execute(commands: string, options: SSMExecuteOptions = {}): Promise<SSMExecuteResult> {
    const { timeout = 120, label = 'Command', stream = true } = options;
    const commandId = this._sendCommand(commands);
    if (!commandId) return { success: false, error: 'Failed to send command' };

    log.info(`SSM Command ID: ${commandId}`);
    if (stream) {
      console.log('');
      console.log(c.cyan('─────────────────────────────────────────────────────────────────'));
      console.log(c.cyan(` Live Output: ${label}`));
      console.log(c.cyan('─────────────────────────────────────────────────────────────────'));
    } else {
      log.info(`Waiting for ${label}...`);
    }

    const result = await this._waitForCompletion(commandId, timeout, stream);
    console.log('');

    if (result.success) {
      return stream ? { success: true, output: '' } : { success: true, output: this._getOutput(commandId) };
    }
    return { success: false, status: result.status, error: this._getError(commandId) };
  }

  _sendCommand(commands: string): string | null {
    const lines = commands.split('\n').filter((l) => l.trim());
    try {
      return aws(
        `ssm send-command --instance-ids ${this.instanceId} --document-name "AWS-RunShellScript" --parameters '{"commands":${JSON.stringify(lines)}}' --query 'Command.CommandId' --output text`,
        { region: this.region }
      );
    } catch (e: unknown) {
      const error = e as Error;
      log.fail(`Failed to send SSM command: ${error.message}`);
      return null;
    }
  }

  async _waitForCompletion(commandId: string, timeout: number, stream = false): Promise<{ success: boolean; status?: string }> {
    const maxIterations = Math.ceil(timeout / 2);
    let lastOutputLen = 0;

    for (let i = 0; i < maxIterations; i++) {
      await sleep(2000);
      if (stream) {
        const output = this._getOutput(commandId);
        if (output && output.length > lastOutputLen) {
          process.stdout.write(c.dim(output.substring(lastOutputLen)));
          lastOutputLen = output.length;
        }
      }

      const status = aws(
        `ssm get-command-invocation --command-id ${commandId} --instance-id ${this.instanceId} --query 'Status' --output text`,
        { ignoreError: true, region: this.region }
      );

      if (status === 'Success') {
        if (stream) {
          const output = this._getOutput(commandId);
          if (output && output.length > lastOutputLen) process.stdout.write(c.dim(output.substring(lastOutputLen)));
        }
        return { success: true };
      }
      if (['Failed', 'Cancelled', 'TimedOut'].includes(status)) {
        if (stream) {
          const output = this._getOutput(commandId);
          if (output && output.length > lastOutputLen) process.stdout.write(c.dim(output.substring(lastOutputLen)));
        }
        return { success: false, status };
      }
      if (!stream && i % 5 === 0) process.stdout.write(c.dim('.'));
    }
    return { success: false, status: 'Timeout' };
  }

  _getOutput(commandId: string): string {
    return aws(
      `ssm get-command-invocation --command-id ${commandId} --instance-id ${this.instanceId} --query 'StandardOutputContent' --output text`,
      { ignoreError: true, region: this.region }
    );
  }

  _getError(commandId: string): string {
    return aws(
      `ssm get-command-invocation --command-id ${commandId} --instance-id ${this.instanceId} --query 'StandardErrorContent' --output text`,
      { ignoreError: true, region: this.region }
    );
  }

  getStatus(): string {
    return aws(
      `ssm describe-instance-information --filters "Key=InstanceIds,Values=${this.instanceId}" --query 'InstanceInformationList[0].PingStatus' --output text`,
      { ignoreError: true, region: this.region }
    ) || 'None';
  }
}

/**
 * Get SSM instance status and agent details.
 * Returns status ('Online', 'NOT_CONNECTED', 'NO_INSTANCE') and optional agent details.
 */
export function ssmGetInstanceStatus(
  instanceId: string,
  region?: string
): { status: string; details: { agentVersion?: string; platformName?: string } | null } {
  if (!instanceId) return { status: 'NO_INSTANCE', details: null };

  const reg = region || awsGetRegion();
  const result = aws(
    `ssm describe-instance-information --filters "Key=InstanceIds,Values=${instanceId}" --output json`,
    { ignoreError: true, region: reg }
  );

  if (!result) return { status: 'NOT_CONNECTED', details: null };

  const data = safeParseJson(result, SSMInstanceInfoSchema, () => {});
  const info = data?.InstanceInformationList?.[0];
  if (!info) return { status: 'NOT_CONNECTED', details: null };

  return {
    status: info.PingStatus || 'Unknown',
    details: { agentVersion: info.AgentVersion, platformName: info.PlatformName },
  };
}
