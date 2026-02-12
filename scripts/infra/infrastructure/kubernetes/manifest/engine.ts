/**
 * Simple Template Engine for Kubernetes Manifests
 *
 * Supports:
 *   - Variable substitution: {{variableName}}
 *   - Nested properties: {{object.property}}
 *   - Default values: {{variableName:defaultValue}}
 *   - Conditionals: {{#if condition}}...{{/if}}
 *   - Loops: {{#each items}}...{{/each}}
 */

export interface TemplateContext {
  [key: string]: unknown;
}

/**
 * Get a nested property from an object using dot notation.
 * @example getValue({ a: { b: 1 } }, 'a.b') // returns 1
 */
function getValue(context: TemplateContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Process {{#if condition}}...{{/if}} blocks.
 */
function processConditionals(template: string, context: TemplateContext): string {
  const ifPattern = /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return template.replace(ifPattern, (_, condition: string, content: string) => {
    const value = getValue(context, condition);
    // Truthy check: non-empty string, non-zero number, true, non-empty array
    const isTruthy = Boolean(value) &&
      !(Array.isArray(value) && value.length === 0) &&
      value !== 'false' &&
      value !== '0';
    return isTruthy ? content : '';
  });
}

/**
 * Process {{#each items}}...{{/each}} blocks.
 * Inside the block:
 *   - {{.}} refers to current item (for primitives)
 *   - {{@index}} is the current index
 *   - {{@key}} is the key (for object iteration)
 *   - {{propertyName}} accesses item properties (for objects)
 */
function processLoops(template: string, context: TemplateContext): string {
  const eachPattern = /\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachPattern, (_, arrayPath: string, content: string) => {
    const items = getValue(context, arrayPath);

    if (!items) return '';

    // Handle arrays
    if (Array.isArray(items)) {
      return items.map((item, index) => {
        let result = content;
        // Replace {{.}} with the item itself (for primitive arrays)
        result = result.replace(/\{\{\.\}\}/g, String(item));
        // Replace {{@index}} with the index
        result = result.replace(/\{\{@index\}\}/g, String(index));
        // If item is an object, process nested variables
        if (typeof item === 'object' && item !== null) {
          const itemContext = { ...context, ...item, '@index': index };
          result = processVariables(result, itemContext);
        }
        return result;
      }).join('');
    }

    // Handle objects (iterate over key-value pairs)
    if (typeof items === 'object') {
      const entries = Object.entries(items as Record<string, unknown>);
      return entries.map(([key, value], index) => {
        let result = content;
        result = result.replace(/\{\{@key\}\}/g, key);
        result = result.replace(/\{\{@value\}\}/g, String(value));
        result = result.replace(/\{\{@index\}\}/g, String(index));
        result = result.replace(/\{\{\.\}\}/g, String(value));
        return result;
      }).join('');
    }

    return '';
  });
}

/**
 * Process {{variableName}} and {{variableName:default}} substitutions.
 */
function processVariables(template: string, context: TemplateContext): string {
  // Match {{path}} or {{path:default}}
  const varPattern = /\{\{([^#/}]+?)(?::([^}]*))?\}\}/g;

  return template.replace(varPattern, (match, path: string, defaultValue?: string) => {
    const trimmedPath = path.trim();

    // Skip special variables that should be handled elsewhere
    if (trimmedPath.startsWith('@') || trimmedPath === '.') {
      return match;
    }

    const value = getValue(context, trimmedPath);

    if (value === undefined || value === null) {
      return defaultValue !== undefined ? defaultValue : '';
    }

    return String(value);
  });
}

/**
 * Render a template string with the given context.
 *
 * @example
 * render('Hello {{name}}!', { name: 'World' })
 * // Returns: 'Hello World!'
 *
 * @example
 * render('{{#each items}}  - {{.}}\n{{/each}}', { items: ['a', 'b'] })
 * // Returns: '  - a\n  - b\n'
 */
export function render(template: string, context: TemplateContext): string {
  let result = template;

  // Process in order: conditionals, loops, then variables
  result = processConditionals(result, context);
  result = processLoops(result, context);
  result = processVariables(result, context);

  return result;
}

/**
 * Validate that all required variables are provided.
 * Returns array of missing variable names.
 */
export function validateTemplate(template: string, context: TemplateContext): string[] {
  const varPattern = /\{\{([^#/@.}][^#/}]*?)(?::[^}]*)?\}\}/g;
  const missing: string[] = [];
  let match;

  while ((match = varPattern.exec(template)) !== null) {
    const path = match[1].trim();
    const value = getValue(context, path);
    if (value === undefined || value === null) {
      if (!missing.includes(path)) {
        missing.push(path);
      }
    }
  }

  return missing;
}

/**
 * Extract all variable names from a template.
 */
export function extractVariables(template: string): string[] {
  const varPattern = /\{\{([^#/@.}][^#/}]*?)(?::[^}]*)?\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = varPattern.exec(template)) !== null) {
    const path = match[1].trim();
    if (!variables.includes(path)) {
      variables.push(path);
    }
  }

  return variables;
}
