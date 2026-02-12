/**
 * Manifest Renderer
 *
 * Loads YAML templates from files and renders them with context.
 */

import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { render, validateTemplate, extractVariables, type TemplateContext } from './engine.js';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Default templates directory */
const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Options for rendering manifests.
 */
export interface RenderOptions {
  /** Custom templates directory (defaults to built-in templates) */
  templatesDir?: string;
  /** Validate that all required variables are provided */
  validate?: boolean;
  /** Throw error if validation fails (default: true) */
  strict?: boolean;
}

/**
 * Result of rendering a manifest.
 */
export interface RenderResult {
  /** The rendered manifest YAML */
  manifest: string;
  /** Variables used in the template */
  variables: string[];
  /** Missing variables (if any) */
  missing: string[];
}

/**
 * Load and render a template file.
 *
 * @param templateName - Name of the template (without .yaml extension)
 * @param context - Variables to substitute in the template
 * @param options - Rendering options
 * @returns Rendered manifest string
 *
 * @example
 * const manifest = renderManifest('configmap', {
 *   name: 'app-config',
 *   namespace: 'default',
 *   data: { KEY: 'value' }
 * });
 */
export function renderManifest(
  templateName: string,
  context: TemplateContext,
  options: RenderOptions = {}
): string {
  const result = renderManifestWithInfo(templateName, context, options);
  return result.manifest;
}

/**
 * Load and render a template file with additional information.
 *
 * @param templateName - Name of the template (without .yaml extension)
 * @param context - Variables to substitute in the template
 * @param options - Rendering options
 * @returns RenderResult with manifest and metadata
 */
export function renderManifestWithInfo(
  templateName: string,
  context: TemplateContext,
  options: RenderOptions = {}
): RenderResult {
  const {
    templatesDir = TEMPLATES_DIR,
    validate = true,
    strict = true,
  } = options;

  const templatePath = path.join(templatesDir, `${templateName}.yaml`);

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const template = readFileSync(templatePath, 'utf-8');
  const variables = extractVariables(template);
  const missing = validate ? validateTemplate(template, context) : [];

  if (strict && missing.length > 0) {
    throw new Error(
      `Missing required variables for template '${templateName}': ${missing.join(', ')}`
    );
  }

  const manifest = render(template, context);

  return {
    manifest,
    variables,
    missing,
  };
}

/**
 * Render a template string directly (without loading from file).
 *
 * @param template - Template string
 * @param context - Variables to substitute
 * @returns Rendered string
 *
 * @example
 * const yaml = renderInline(`
 * apiVersion: v1
 * kind: ConfigMap
 * metadata:
 *   name: {{name}}
 * `, { name: 'my-config' });
 */
export function renderInline(template: string, context: TemplateContext): string {
  return render(template, context);
}

/**
 * Check if a template exists.
 *
 * @param templateName - Name of the template (without .yaml extension)
 * @param templatesDir - Custom templates directory
 */
export function templateExists(templateName: string, templatesDir?: string): boolean {
  const dir = templatesDir ?? TEMPLATES_DIR;
  const templatePath = path.join(dir, `${templateName}.yaml`);
  return existsSync(templatePath);
}

/**
 * Get the path to the templates directory.
 */
export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}

/**
 * Join multiple YAML documents with '---' separator.
 *
 * @param documents - Array of YAML document strings
 * @returns Combined YAML string
 */
export function joinManifests(...documents: string[]): string {
  return documents
    .filter(doc => doc.trim().length > 0)
    .join('\n---\n');
}
