/**
 * Tests for Template Engine functions
 */
import { describe, it, expect } from 'vitest';
import { render, extractVariables, validateTemplate } from '../../../../infrastructure/kubernetes/manifest/engine.js';

describe('render', () => {
  it('substitutes simple variables', () => {
    const result = render('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('handles nested properties', () => {
    const result = render('{{user.name}}', { user: { name: 'John' } });
    expect(result).toBe('John');
  });

  it('uses default values', () => {
    const result = render('{{missing:default}}', {});
    expect(result).toBe('default');
  });

  it('processes conditional blocks', () => {
    const template = '{{#if enabled}}ON{{/if}}';
    expect(render(template, { enabled: true })).toBe('ON');
    expect(render(template, { enabled: false })).toBe('');
  });

  it('processes array loops', () => {
    const template = '{{#each items}}{{.}},{{/each}}';
    const result = render(template, { items: ['a', 'b', 'c'] });
    expect(result).toBe('a,b,c,');
  });

  it('processes object loops with @key and @value', () => {
    const template = '{{#each config}}{{@key}}={{@value}};{{/each}}';
    const result = render(template, { config: { a: '1', b: '2' } });
    expect(result).toContain('a=1');
    expect(result).toContain('b=2');
  });

  it('handles @index in loops', () => {
    const template = '{{#each items}}{{@index}}:{{.}},{{/each}}';
    const result = render(template, { items: ['x', 'y'] });
    expect(result).toBe('0:x,1:y,');
  });
});

describe('extractVariables', () => {
  it('extracts variable names from template', () => {
    const template = 'Hello {{name}}, your age is {{age}}';
    const result = extractVariables(template);
    expect(result).toContain('name');
    expect(result).toContain('age');
    expect(result).toHaveLength(2);
  });

  it('extracts nested property paths', () => {
    const template = '{{user.name}} {{user.email}}';
    const result = extractVariables(template);
    expect(result).toContain('user.name');
    expect(result).toContain('user.email');
  });
});

describe('validateTemplate', () => {
  it('returns empty array when all variables provided', () => {
    const template = '{{name}} {{age}}';
    const result = validateTemplate(template, { name: 'John', age: 30 });
    expect(result).toEqual([]);
  });

  it('returns missing variable names', () => {
    const template = '{{name}} {{missing}}';
    const result = validateTemplate(template, { name: 'John' });
    expect(result).toContain('missing');
  });
});
