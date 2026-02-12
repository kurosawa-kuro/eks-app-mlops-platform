/**
 * SSM Adapter - Execute commands on EC2 instances via AWS SSM
 *
 * Used for accessing private EKS clusters through a bastion host
 */

import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from '@aws-sdk/client-ssm'

export interface SSMExecuteResult {
  success: boolean
  output?: string
  error?: string
}

export interface SSMAdapterConfig {
  region: string
  bastionInstanceId: string
}

export class SSMAdapter {
  private client: SSMClient
  private bastionInstanceId: string

  constructor(config: SSMAdapterConfig) {
    this.client = new SSMClient({ region: config.region })
    this.bastionInstanceId = config.bastionInstanceId
  }

  async execute(commands: string[], timeoutSeconds = 60): Promise<SSMExecuteResult> {
    try {
      // Send command
      const sendCommand = new SendCommandCommand({
        InstanceIds: [this.bastionInstanceId],
        DocumentName: 'AWS-RunShellScript',
        Parameters: {
          commands: commands,
        },
        TimeoutSeconds: timeoutSeconds,
      })

      const sendResult = await this.client.send(sendCommand)
      const commandId = sendResult.Command?.CommandId

      if (!commandId) {
        return { success: false, error: 'Failed to get command ID' }
      }

      // Wait for completion
      const result = await this.waitForCompletion(commandId, timeoutSeconds)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async waitForCompletion(commandId: string, timeoutSeconds: number): Promise<SSMExecuteResult> {
    const maxIterations = Math.ceil(timeoutSeconds / 2)

    for (let i = 0; i < maxIterations; i++) {
      await this.sleep(2000)

      try {
        const getCommand = new GetCommandInvocationCommand({
          CommandId: commandId,
          InstanceId: this.bastionInstanceId,
        })

        const result = await this.client.send(getCommand)
        const status = result.Status

        if (status === 'Success') {
          return {
            success: true,
            output: result.StandardOutputContent || '',
          }
        }

        if (status === 'Failed' || status === 'Cancelled' || status === 'TimedOut') {
          return {
            success: false,
            error: result.StandardErrorContent || `Command ${status}`,
          }
        }

        // Still in progress, continue waiting
      } catch (error) {
        // GetCommandInvocation might fail if command is still pending
        // Continue waiting
      }
    }

    return { success: false, error: 'Command timed out' }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
