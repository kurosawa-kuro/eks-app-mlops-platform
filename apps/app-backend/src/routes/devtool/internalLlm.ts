import { Hono } from 'hono'
import { env } from '../../config/env.js'

const devtoolInternalLlm = new Hono()

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function buildUrl(baseUrl: string, path: string): string {
  return `${stripTrailingSlash(baseUrl)}${path}`
}

/**
 * GET /internal/llm/health
 * - checks upstream health endpoints
 * - embeddings is optional (only checked if URL is configured)
 */
devtoolInternalLlm.get('/health', async (c) => {
  const inferenceUrl = env.LLM_INFERENCE_URL
  const embeddingsUrl = env.LLM_EMBEDDINGS_URL

  if (!inferenceUrl) {
    return c.json({ ok: false, error: 'LLM_INFERENCE_URL not configured' }, 503)
  }

  const checkHealth = async (url: string) => {
    try {
      const r = await fetch(buildUrl(url, '/health'))
      return { ok: r.ok, status: r.status }
    } catch {
      return { ok: false, status: 0, error: 'Connection failed' }
    }
  }

  const inf = await checkHealth(inferenceUrl)

  // Embeddings is optional
  const emb = embeddingsUrl ? await checkHealth(embeddingsUrl) : null

  return c.json({
    ok: inf.ok,  // Only inference is required
    inference: inf,
    embeddings: emb,
  })
})

/**
 * POST /internal/llm/chat
 * - proxies to vLLM OpenAI-compatible endpoint: /v1/chat/completions
 */
devtoolInternalLlm.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON' }, 400)

  const url = buildUrl(env.LLM_INFERENCE_URL!, '/v1/chat/completions')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  })
})

/**
 * POST /internal/llm/embeddings
 * - proxies to TEI OpenAI-compatible endpoint: /v1/embeddings
 */
devtoolInternalLlm.post('/embeddings', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON' }, 400)

  const url = buildUrl(env.LLM_EMBEDDINGS_URL!, '/v1/embeddings')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  })
})

export { devtoolInternalLlm }
