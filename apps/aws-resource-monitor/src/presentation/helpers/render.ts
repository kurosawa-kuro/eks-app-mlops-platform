import * as ejs from 'ejs'
import * as path from 'path'
import { fileURLToPath } from 'node:url'
import type { Context } from 'hono'
import {
  getStatusClass,
  getStatusLabel,
  getCostClass,
  getCostBadge,
  formatDate
} from './awsFormatters.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const viewsDir = path.join(__dirname, '..', 'views')
const layoutsDir = path.join(viewsDir, 'layouts')

interface RenderOptions {
  layout?: string
  [key: string]: unknown
}

export async function render(
  c: Context,
  template: string,
  data: RenderOptions = {}
): Promise<Response> {
  const { layout = 'main', ...viewData } = data

  // 共通ヘルパー関数を全テンプレートに自動注入
  const helpers = {
    getStatusClass,
    getStatusLabel,
    getCostClass,
    getCostBadge,
    formatDate
  }

  const templatePath = path.join(viewsDir, `${template}.ejs`)
  const body = await ejs.renderFile(templatePath, { ...viewData, helpers })

  if (layout) {
    const layoutPath = path.join(layoutsDir, `${layout}.ejs`)
    const html = await ejs.renderFile(layoutPath, {
      ...viewData,
      helpers,
      body
    })
    return c.html(html)
  }

  return c.html(body)
}
