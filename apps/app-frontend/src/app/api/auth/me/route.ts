import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Forward the cookie from the incoming request
      cookie: request.headers.get('cookie') ?? '',
    },
  })

  const data = await response.json()

  return NextResponse.json(data, { status: response.status })
}
