/**
 * Input validation utilities.
 */

import * as fs from 'fs';
import type { FileValidationOptions } from '../types.js';
import { formatBytes } from './format.js';

/**
 * Validate AWS resource name to prevent shell injection
 */
export function validateResourceName(name: string | undefined | null, resourceType = 'resource'): string {
  if (!name || typeof name !== 'string') {
    throw new Error(`${resourceType} name is required`);
  }
  if (!/^[a-zA-Z0-9-_./]+$/.test(name)) {
    throw new Error(`Invalid ${resourceType} name: "${name}". Only alphanumeric, hyphens, underscores, dots, and forward slashes are allowed.`);
  }
  if (name.includes('..')) {
    throw new Error(`Invalid ${resourceType} name: "${name}". Path traversal not allowed.`);
  }
  return name;
}

/**
 * Validate EC2 instance ID format (i-xxxxxxxxxxxxxxxxx)
 */
export function validateInstanceId(id: string | undefined | null): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Instance ID is required');
  }
  if (!/^i-[a-f0-9]{8,17}$/.test(id)) {
    throw new Error(`Invalid instance ID: "${id}". Expected format: i-xxxxxxxxxxxxxxxxx`);
  }
  return id;
}

/**
 * Validate port number (1-65535)
 */
export function validatePort(port: string | number | undefined | null, label = 'port'): string {
  const num = typeof port === 'string' ? parseInt(port, 10) : port;
  // typeof check handles null/undefined, Number.isInteger handles NaN/floats
  if (typeof num !== 'number' || !Number.isInteger(num) || num < 1 || num > 65535) {
    throw new Error(`Invalid ${label}: "${port}". Must be a number between 1 and 65535.`);
  }
  return String(num);
}

/**
 * Validate overlay/environment name (alphanumeric + hyphen only)
 */
export function validateOverlayName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Overlay name is required');
  }
  if (!/^[a-zA-Z0-9-]+$/.test(name)) {
    throw new Error(`Invalid overlay name: "${name}". Only alphanumeric characters and hyphens are allowed.`);
  }
  return name;
}

/**
 * Validate step argument (alphanumeric or 'all', 'status', etc.)
 */
export function validateStepArg(step: string | undefined | null): string {
  if (!step || typeof step !== 'string') {
    throw new Error('Step argument is required');
  }
  if (!/^[a-zA-Z0-9-]+$/.test(step)) {
    throw new Error(`Invalid step: "${step}". Only alphanumeric characters and hyphens are allowed.`);
  }
  return step;
}

/**
 * Validate shell command (basic sanitization - no semicolons, pipes for injection)
 */
export function validateCommand(cmd: string | undefined | null): string {
  if (!cmd || typeof cmd !== 'string') {
    throw new Error('Command is required');
  }
  const dangerousPatterns = [/;\s*rm\s/, /;\s*dd\s/, /`/, /\$\(/, /\|\s*sh/, /\|\s*bash/];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      throw new Error(`Potentially dangerous command pattern detected: "${cmd}"`);
    }
  }
  return cmd;
}

/**
 * [BOUNDARY: File System]
 * Validate file for reading (exists, is regular file, not empty, size limit).
 */
export function validateFileInput(filePath: string | undefined | null, options: FileValidationOptions = {}): string {
  const { maxSize = 10 * 1024 * 1024 } = options;

  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(`Not a regular file: ${filePath} (is it a directory?)`);
  }

  if (stats.size === 0) {
    throw new Error(`File is empty: ${filePath}`);
  }

  if (stats.size > maxSize) {
    throw new Error(`File too large: ${filePath} (${formatBytes(stats.size)} > ${formatBytes(maxSize)})`);
  }

  return filePath;
}

/**
 * Escape string for use in sed replacement pattern.
 * Escapes: & \ / # (sed delimiter and special chars)
 */
export function escapeSedReplacement(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/&/g, '\\&')    // Escape & (backreference)
    .replace(/\//g, '\\/')   // Escape / (common delimiter)
    .replace(/#/g, '\\#')    // Escape # (our delimiter)
    .replace(/\n/g, '\\n');  // Escape newlines
}
