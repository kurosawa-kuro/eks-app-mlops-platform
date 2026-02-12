/**
 * Request Helpers
 * --------------------------------
 * テスト用のリクエスト作成ヘルパー
 */

type RequestInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

/**
 * JSONリクエストオプションを作成
 */
export function jsonRequest(method: 'POST' | 'PUT' | 'PATCH', body: object): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

/**
 * POSTリクエストオプションを作成
 */
export function postJson(body: object): RequestInit {
  return jsonRequest('POST', body)
}

/**
 * PUTリクエストオプションを作成
 */
export function putJson(body: object): RequestInit {
  return jsonRequest('PUT', body)
}

/**
 * API Keyヘッダーを追加
 */
export function withApiKey(apiKey: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      'X-API-Key': apiKey
    }
  }
}

/**
 * Authorizationヘッダーを追加
 */
export function withAuth(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...init.headers,
      'Authorization': `Bearer ${token}`
    }
  }
}

/**
 * CORSプリフライトリクエストを作成
 */
export function corsPreflightRequest(origin: string): RequestInit {
  return {
    method: 'OPTIONS',
    headers: {
      'Origin': origin,
      'Access-Control-Request-Method': 'POST'
    }
  }
}

/**
 * OriginヘッダーのみのGETリクエスト
 */
export function withOrigin(origin: string): RequestInit {
  return {
    headers: { 'Origin': origin }
  }
}
