import { NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json({
      status: response.status,
      backend_url: API_URL,
      data,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      backend_url: API_URL,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
