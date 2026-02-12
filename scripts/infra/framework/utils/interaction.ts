/**
 * User interaction utilities.
 */

import * as readline from 'readline';
import type { ConfirmOptions } from '../types.js';
import { c } from '../logging/index.js';

/**
 * [BOUNDARY: stdin/stdout]
 * Ask user for confirmation with optional timeout.
 */
export function confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const { timeoutMs = 0, defaultOnTimeout = false } = options;

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      rl.close();
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        console.log(c.yellow(`\n  Timeout after ${timeoutMs / 1000}s - using default: ${defaultOnTimeout ? 'yes' : 'no'}`));
        cleanup();
        resolve(defaultOnTimeout);
      }, timeoutMs);
    }

    rl.question(`${message} (y/N): `, (answer: string) => {
      cleanup();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export function formatTable(headers: string[], rows: string[][], widths: number[]): void {
  const headerLine = headers.map((h, i) => h.padEnd(widths[i] || 20)).join('');
  const separatorLine = headers.map((_, i) => '-'.repeat((widths[i] || 20) - 1).padEnd(widths[i] || 20)).join('');
  console.log('  ' + headerLine);
  console.log('  ' + separatorLine);
  for (const row of rows) {
    const line = row.map((cell, i) => (cell || '').substring(0, (widths[i] || 20) - 1).padEnd(widths[i] || 20)).join('');
    console.log('  ' + line);
  }
}
