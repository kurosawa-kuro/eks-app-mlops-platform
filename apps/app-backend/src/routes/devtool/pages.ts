import { Hono } from 'hono'
import { env } from '../../config/env.js'
import { renderPage } from '../../config/ejs.js'

const devtoolPages = new Hono()

/**
 * GET /devtool - Developer Tools Dashboard
 */
devtoolPages.get('/', (c) => {
  const html = renderPage('devtool/index', {
    title: 'DevTool - Health & Diagnostics',
    nodeEnv: env.NODE_ENV,
    currentPath: '/devtool',
    navType: 'devtool',
  })
  return c.html(html)
})

export { devtoolPages }
