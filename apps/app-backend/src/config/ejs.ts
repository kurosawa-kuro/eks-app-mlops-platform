import ejs from 'ejs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const viewsDir = path.join(__dirname, '..', 'views')

/**
 * Template cache for production
 */
const templateCache = new Map<string, ejs.TemplateFunction>()

/**
 * Get compiled template (with caching in production)
 */
function getTemplate(templatePath: string): ejs.TemplateFunction {
  const useCache = process.env.NODE_ENV === 'production'

  if (useCache && templateCache.has(templatePath)) {
    return templateCache.get(templatePath)!
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8')
  const compiled = ejs.compile(templateContent, {
    filename: templatePath,
    views: [viewsDir],
  })

  if (useCache) {
    templateCache.set(templatePath, compiled)
  }

  return compiled
}

/**
 * Helper to render template with layout support
 *
 * Templates can specify a layout by setting `layout` in the data.
 * The page content will be passed to the layout as `body`.
 */
export function renderPage(
  template: string,
  data: Record<string, unknown> = {}
): string {
  const templatePath = path.join(viewsDir, `${template}.ejs`)

  // First render the page template
  const pageTemplate = getTemplate(templatePath)
  const pageContent = pageTemplate(data)

  // Check if layout is specified (default to base layout)
  const layoutName = data.layout as string | false | undefined

  // If no layout, return page content directly
  if (layoutName === false || layoutName === 'none') {
    return pageContent
  }

  // Use default layout if not specified
  const layout = layoutName || 'layouts/base'

  // Render with layout - pass page content as 'body'
  const layoutPath = path.join(viewsDir, `${layout}.ejs`)
  const layoutTemplate = getTemplate(layoutPath)
  const html = layoutTemplate({
    ...data,
    body: pageContent,
  })

  return html
}
