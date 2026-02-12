/**
 * Masking utilities for sensitive data.
 */

import { log } from '../logging/index.js';

export function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function maskPassword(str: string): string {
  return str.replace(/(:)[^:@]+(@)/g, '$1****$2');
}

export function maskToken(str: string): string {
  return str.replace(/(webhooks\/[0-9]+\/)[^/]+/g, '$1****');
}

export function maskSecretValue(value: string | null | undefined): string {
  if (!value) return '****';
  if (isJson(value)) {
    try {
      const entries = Object.entries(JSON.parse(value)).slice(0, 3);
      return entries.map(([k]) => `${k}: ****`).join('\n');
    } catch (e: unknown) {
      log.debug(`maskSecretValue JSON parse failed: ${(e as Error).message || String(e)}`);
    }
  }
  return value.length > 8
    ? `${value.substring(0, 4)}****${value.substring(value.length - 4)}`
    : '****';
}
