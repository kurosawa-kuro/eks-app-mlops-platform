/**
 * Tests for kubernetes/manifests/renderer.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

import {
  renderManifest,
  renderManifestWithInfo,
  renderInline,
  templateExists,
  joinManifests,
} from '../../../../infrastructure/kubernetes/manifest/renderer.js';

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockExistsSync = vi.mocked(fs.existsSync);

describe('renderManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders template with context', () => {
    const template = `apiVersion: v1
kind: ConfigMap
metadata:
  name: {{name}}
  namespace: {{namespace}}`;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(template);

    const result = renderManifest('configmap', {
      name: 'my-config',
      namespace: 'default',
    });

    expect(result).toContain('name: my-config');
    expect(result).toContain('namespace: default');
  });

  it('throws error when template not found', () => {
    mockExistsSync.mockReturnValue(false);

    expect(() =>
      renderManifest('nonexistent', {})
    ).toThrow('Template not found');
  });

  it('throws error for missing required variables in strict mode', () => {
    const template = '{{name}} {{missing}}';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(template);

    expect(() =>
      renderManifest('test', { name: 'value' }, { strict: true })
    ).toThrow('Missing required variables');
  });

  it('uses custom templates directory', () => {
    const customDir = '/custom/templates';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{{name}}');

    renderManifest('test', { name: 'value' }, { templatesDir: customDir });

    expect(mockExistsSync).toHaveBeenCalledWith(
      path.join(customDir, 'test.yaml')
    );
  });
});

describe('renderManifestWithInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns manifest with metadata', () => {
    const template = '{{name}} {{description}}';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(template);

    const result = renderManifestWithInfo(
      'test',
      { name: 'value', description: 'desc' },
      { strict: false }
    );

    expect(result.manifest).toBe('value desc');
    expect(result.variables).toContain('name');
    expect(result.variables).toContain('description');
    expect(result.missing).toEqual([]);
  });

  it('includes missing variables when validation enabled', () => {
    const template = '{{name}} {{missing}}';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(template);

    const result = renderManifestWithInfo(
      'test',
      { name: 'value' },
      { validate: true, strict: false }
    );

    expect(result.missing).toContain('missing');
  });

  it('skips validation when disabled', () => {
    const template = '{{name}} {{missing}}';
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(template);

    const result = renderManifestWithInfo(
      'test',
      { name: 'value' },
      { validate: false }
    );

    expect(result.missing).toEqual([]);
  });
});

describe('renderInline', () => {
  it('renders inline template', () => {
    const template = 'Hello {{name}}!';
    const result = renderInline(template, { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('handles nested properties', () => {
    const template = '{{user.name}} - {{user.email}}';
    const result = renderInline(template, {
      user: { name: 'John', email: 'john@example.com' },
    });
    expect(result).toBe('John - john@example.com');
  });

  it('handles conditionals', () => {
    const template = '{{#if enabled}}ON{{/if}}{{#if disabled}}OFF{{/if}}';
    const result = renderInline(template, { enabled: true, disabled: false });
    expect(result).toBe('ON');
  });
});

describe('templateExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when template exists', () => {
    mockExistsSync.mockReturnValue(true);
    expect(templateExists('existing')).toBe(true);
  });

  it('returns false when template does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(templateExists('nonexistent')).toBe(false);
  });

  it('uses custom templates directory', () => {
    mockExistsSync.mockReturnValue(true);
    templateExists('test', '/custom/dir');
    expect(mockExistsSync).toHaveBeenCalledWith('/custom/dir/test.yaml');
  });
});

describe('joinManifests', () => {
  it('joins multiple manifests with separator', () => {
    const result = joinManifests(
      'apiVersion: v1\nkind: ConfigMap',
      'apiVersion: v1\nkind: Secret'
    );
    expect(result).toContain('---');
    expect(result).toContain('ConfigMap');
    expect(result).toContain('Secret');
  });

  it('filters out empty documents', () => {
    const result = joinManifests('doc1', '', '  ', 'doc2');
    expect(result).toBe('doc1\n---\ndoc2');
  });

  it('handles single document', () => {
    const result = joinManifests('single-doc');
    expect(result).toBe('single-doc');
  });

  it('returns empty string for no documents', () => {
    const result = joinManifests();
    expect(result).toBe('');
  });
});
