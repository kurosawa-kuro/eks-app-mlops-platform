import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  // Create NextResponse and forward all Set-Cookie headers
  const nextResponse = NextResponse.json(data, { status: response.status })

  // Forward Set-Cookie headers from backend
  // Use getSetCookie() if available, fallback to get()
  const setCookieHeaders = response.headers.getSetCookie?.() ?? []
  if (setCookieHeaders.length > 0) {
    for (const cookie of setCookieHeaders) {
      nextResponse.headers.append('Set-Cookie', cookie)
    }
  } else {
    // Fallback: try to get the raw header
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      nextResponse.headers.set('Set-Cookie', setCookie)
    }
  }

  return nextResponse
}
