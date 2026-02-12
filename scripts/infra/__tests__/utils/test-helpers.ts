/**
 * Test Utilities for awilix-style Dependency Injection
 *
 * Provides mock factories and helper functions for testing
 * classes with dependency injection patterns.
 */

import { vi, expect, type Mock } from 'vitest';
import type { DeployerConfig } from '../../infrastructure/kubernetes/deploy/deployers-types.js';

// ============================================================
// Mock Logger
// ============================================================

export interface MockLogger {
  pass: Mock;
  fail: Mock;
  info: Mock;
  warn: Mock;
  debug: Mock;
  skip: Mock;
  dryRun: Mock;
  success: Mock;
  error: Mock;
  warning: Mock;
  header: Mock;
  section: Mock;
  phase: Mock;
  status: Mock;
}

export function createMockLogger(): MockLogger {
  return {
    pass: vi.fn(),
    fail: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    skip: vi.fn(),
    dryRun: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    header: vi.fn(),
    section: vi.fn(),
    phase: vi.fn(),
    status: vi.fn(),
  };
}

// ============================================================
// Mock Deployer Dependencies
// ============================================================

export interface MockDeployerDependencies {
  run: Mock;
  log: MockLogger;
}

/**
 * Creates mock dependencies for ManifestDeployer and HelmDeployer.
 *
 * @example
 * const deps = createMockDeployerDependencies();
 * const deployer = new ManifestDeployer(config, deps);
 *
 * await deployer.applyManifest('...');
 * expect(deps.run).toHaveBeenCalledWith(expect.stringContaining('kubectl'));
 */
export function createMockDeployerDependencies(
  overrides: Partial<MockDeployerDependencies> = {}
): MockDeployerDependencies {
  return {
    run: vi.fn().mockReturnValue('mock-output'),
    log: createMockLogger(),
    ...overrides,
  };
}

// ============================================================
// Mock Deployer Config
// ============================================================

/**
 * Creates a DeployerConfig with sensible test defaults.
 *
 * @example
 * const config = createMockDeployerConfig({ namespace: 'my-app' });
 */
export function createMockDeployerConfig(
  overrides: Partial<DeployerConfig> = {}
): DeployerConfig {
  return {
    namespace: 'test-namespace',
    silent: true,
    dryRun: false,
    ...overrides,
  };
}

// ============================================================
// Mock Poller Dependencies
// ============================================================

export interface MockPollerDependencies {
  sleep: Mock;
}

/**
 * Creates mock dependencies for Poller.
 *
 * @example
 * const deps = createMockPollerDependencies();
 * const poller = new Poller(60, 5, deps);
 */
export function createMockPollerDependencies(): MockPollerDependencies {
  return {
    sleep: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Assertion Helpers
// ============================================================

/**
 * Asserts that a mock was called with a command containing the expected substring.
 */
export function expectRunCalledWith(
  runMock: Mock,
  expectedSubstring: string
): void {
  expect(runMock).toHaveBeenCalled();
  const calls = runMock.mock.calls;
  const hasMatch = calls.some(
    (call: unknown[]) => typeof call[0] === 'string' && call[0].includes(expectedSubstring)
  );
  expect(hasMatch).toBe(true);
}

/**
 * Gets all commands passed to the run mock.
 */
export function getRunCommands(runMock: Mock): string[] {
  return runMock.mock.calls.map((call: unknown[]) => call[0] as string);
}
