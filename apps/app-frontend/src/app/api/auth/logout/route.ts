import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward the cookie from the incoming request
      cookie: request.headers.get('cookie') ?? '',
    },
  })

  const data = await response.json()

  // Create NextResponse and forward all Set-Cookie headers (for clearing)
  const nextResponse = NextResponse.json(data, { status: response.status })

  // Forward Set-Cookie headers from backend (to clear the cookie)
  const setCookieHeaders = response.headers.getSetCookie()
  for (const cookie of setCookieHeaders) {
    nextResponse.headers.append('Set-Cookie', cookie)
  }

  return nextResponse
}
