/**
 * DeployAll UseCase
 *
 * Orchestrates full EKS deployment through 9 phases.
 * Follows 起承転結 (ki-shō-ten-ketsu) narrative structure.
 */

import { execSync } from 'child_process';
import { UseCase, type UseCaseResult } from '../base/UseCase.js';
import type { InfraContainer } from '../../container/types.js';
import { log as defaultLog } from '../../framework/logging/index.js';
import { c } from '../../framework/logging/colors.js';

/**
 * Deployment phase definition.
 */
export interface DeploymentPhase {
  /** Phase number */
  num: number;
  /** Phase name */
  name: string;
  /** Commands to execute */
  commands: string[];
  /** Description */
  description: string;
}

/**
 * Default deployment phases.
 */
export const DEFAULT_PHASES: DeploymentPhase[] = [
  {
    num: 1,
    name: 'AWS認証確認',
    commands: ['make eks-smoke-aws'],
    description: 'AWS CLI 認証を確認',
  },
  {
    num: 2,
    name: 'Shared インフラ + ECR',
    commands: ['make shared-init', 'make shared-deploy', 'make ecr-login', 'make push'],
    description: 'ECR, S3, Firehose 作成 + イメージ push',
  },
  {
    num: 3,
    name: 'EKS インフラ構築',
    commands: ['make eks-init', 'make eks-deploy'],
    description: 'EKS クラスタ作成 (15-20分)',
  },
  {
    num: 4,
    name: 'Namespace + ServiceAccount',
    commands: ['make eks-k8s-init'],
    description: 'K8s 初期設定',
  },
  {
    num: 5,
    name: 'Observability 確認',
    commands: ['make eks-smoke-eks'],
    description: 'CloudWatch / VPC Flow Logs 確認',
  },
  {
    num: 6,
    name: 'Database デプロイ',
    commands: ['make eks-db-deploy', 'make eks-secrets-create', 'make eks-db-status'],
    description: 'CNPG Operator + PostgreSQL Cluster',
  },
  {
    num: 7,
    name: 'App デプロイ',
    commands: ['make eks-k8s-deploy', 'make eks-k8s-status'],
    description: 'Frontend + Backend デプロイ',
  },
  {
    num: 8,
    name: 'Post-Deploy',
    commands: ['make eks-db-migrate', 'make eks-db-seed', 'make eks-auth-setup'],
    description: 'マイグレーション + 認証設定',
  },
  {
    num: 9,
    name: '最終検証',
    commands: ['make eks-verify', 'make eks-smoke-strict'],
    description: 'Health + Login 検証',
  },
];

/**
 * Input for DeployAll UseCase.
 */
export interface DeployAllInput {
  /** Dry-run mode */
  dryRun: boolean;
  /** Start from phase number (1-9) */
  fromPhase: number;
  /** Working directory for make commands */
  cwd?: string;
  /** Custom phases (optional, uses DEFAULT_PHASES if not provided) */
  phases?: DeploymentPhase[];
}

/**
 * Phase result.
 */
export interface DeployAllPhaseResult {
  /** Phase number */
  num: number;
  /** Phase name */
  name: string;
  /** Whether the phase succeeded */
  success: boolean;
  /** Commands executed */
  commandsExecuted: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Output from DeployAll UseCase.
 */
export interface DeployAllOutput {
  /** Total phases run */
  phasesRun: number;
  /** Successful phases */
  phasesSucceeded: number;
  /** Failed phase number (if any) */
  failedPhase?: number;
  /** Phase results */
  phaseResults: DeployAllPhaseResult[];
  /** Whether dry-run mode was used */
  dryRun: boolean;
  /** Resume hint if failed */
  resumeHint?: string;
}

/**
 * UseCase for running full EKS deployment.
 */
export class DeployAll extends UseCase<DeployAllInput, DeployAllOutput> {
  constructor(container: InfraContainer) {
    super(container);
  }

  async execute(input: DeployAllInput): Promise<UseCaseResult<DeployAllOutput>> {
    this.startTimer();
    const log = defaultLog;

    const phases = input.phases || DEFAULT_PHASES;
    const phasesToRun = phases.filter((p) => p.num >= input.fromPhase);
    const phaseResults: DeployAllPhaseResult[] = [];
    let failedPhase: number | undefined;

    try {
      for (const phase of phasesToRun) {
        const phaseType = phase.num <= 2 ? 'setup' : phase.num >= 9 ? 'verification' : 'action';

        let phaseSuccess = true;
        let commandsExecuted = 0;
        let phaseError: string | undefined;

        await this.runPhase(phaseType, `Phase ${phase.num}`, phase.description, async () => {
          log.info(`${phase.name}`);

          for (const cmd of phase.commands) {
            const success = this.runCommand(cmd, input.dryRun, input.cwd);
            commandsExecuted++;

            if (!success) {
              phaseSuccess = false;
              phaseError = `Command failed: ${cmd}`;
              throw new Error(phaseError);
            }
          }
        });

        phaseResults.push({
          num: phase.num,
          name: phase.name,
          success: phaseSuccess,
          commandsExecuted,
          error: phaseError,
        });

        if (!phaseSuccess) {
          failedPhase = phase.num;
          break;
        }
      }

      const phasesSucceeded = phaseResults.filter((r) => r.success).length;

      return this.buildResult({
        phasesRun: phaseResults.length,
        phasesSucceeded,
        failedPhase,
        phaseResults,
        dryRun: input.dryRun,
        resumeHint: failedPhase ? `make eks-deploy-all FROM=${failedPhase}` : undefined,
      });
    } catch (error) {
      // Add remaining phase results
      const phasesSucceeded = phaseResults.filter((r) => r.success).length;

      return this.buildResult({
        phasesRun: phaseResults.length,
        phasesSucceeded,
        failedPhase,
        phaseResults,
        dryRun: input.dryRun,
        resumeHint: failedPhase ? `make eks-deploy-all FROM=${failedPhase}` : undefined,
      });
    }
  }

  /**
   * Run a single command.
   */
  private runCommand(cmd: string, dryRun: boolean, cwd?: string): boolean {
    console.log(c.dim(`  $ ${cmd}`));

    if (dryRun) {
      return true;
    }

    try {
      execSync(cmd, { stdio: 'inherit', cwd: cwd || process.cwd() });
      return true;
    } catch {
      return false;
    }
  }
}
