import type { Server } from 'http'
import request from 'supertest'
import { serve } from '@hono/node-server'
import { app } from '../../../src/app.js'
import { resolve } from '../../../src/container/index.js'

/**
 * Test server instance for HTTP testing
 */
let testServer: Server | null = null

/**
 * Create and start a test server
 */
export function createTestServer(): Server {
  if (testServer) {
    return testServer
  }
  testServer = serve({ fetch: app.fetch, port: 0 }) as Server
  return testServer
}

/**
 * Close the test server
 */
export function closeTestServer(): void {
  if (testServer) {
    testServer.close()
    testServer = null
  }
}

/**
 * Get supertest request agent for the test server
 */
export function getTestRequest() {
  const server = createTestServer()
  return request(server)
}

/**
 * Default test credentials
 */
export const testCredentials = {
  valid: {
    email: 'admin@example.com',
    password: 'password',
  },
}

/**
 * Helper to login and get auth cookies
 */
export async function loginAndGetCookies(
  credentials = testCredentials.valid,
): Promise<string[]> {
  const response = await getTestRequest()
    .post('/api/auth/login')
    .send(credentials)
  const cookies = response.headers['set-cookie']
  if (!cookies) return []
  return Array.isArray(cookies) ? cookies : [cookies]
}

/**
 * Helper to make authenticated request
 */
export async function authenticatedRequest(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  cookies?: string[],
) {
  const authCookies = cookies ?? (await loginAndGetCookies())
  return getTestRequest()[method](path).set('Cookie', authCookies)
}

/**
 * Clear rate limit store (for test isolation)
 */
export function clearRateLimitStore(): void {
  const store = resolve('rateLimitStore')
  store.clear?.()
}
