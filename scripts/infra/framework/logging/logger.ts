/**
 * Logging utilities with colored output.
 */

import type { Logger } from '../types.js';
import { colors, c } from './colors.js';

export const log: Logger = {
  // Primary (icon-based)
  pass: (msg: string) => console.log(`  ${c.green('✓')} ${msg}`),
  fail: (msg: string) => console.log(`  ${c.red('✗')} ${msg}`),
  warn: (msg: string) => console.log(`  ${c.yellow('⚠')} ${msg}`),
  info: (msg: string) => console.log(`  ${c.cyan('ℹ')} ${msg}`),
  skip: (msg: string) => console.log(`  ${c.dim('⊘')} ${msg}`),
  dryRun: (msg: string) => console.log(`  ${c.magenta('[DRY-RUN]')} ${msg}`),
  debug: (msg: string) => { if (process.env.DEBUG === '1') console.log(`  ${c.magenta('[DEBUG]')} ${msg}`); },

  // Structure
  header: (text: string) => {
    console.log('');
    console.log(`${colors.bold}${colors.blue}============================================${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}  ${text}${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}============================================${colors.reset}`);
    console.log('');
  },
  section: (title: string) => {
    console.log('');
    console.log(c.yellow(`── ${title} ──`));
  },
  phase: (num: number, title: string, color: 'cyan' | 'red' = 'cyan') => {
    const colorFn = color === 'red' ? c.red : c.cyan;
    console.log('');
    console.log(c.bold(colorFn('══════════════════════════════════════════════════════════════════')));
    console.log(c.bold(colorFn(` Phase ${num}: ${title}`)));
    console.log(c.bold(colorFn('══════════════════════════════════════════════════════════════════')));
  },
  status: (elapsed: number, interval: number, msg: string) => {
    console.log(`${c.cyan(`[${elapsed}s]`)} ${c.dim(`(${interval}s)`)} ${msg}`);
  },
};
