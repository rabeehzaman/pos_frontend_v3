import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('\n========== AUTH STATUS (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    console.log(`[PROXY] Forwarding to backend: ${backendUrl}/auth/status`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      console.error('[PROXY] Backend auth status error:', data)
      return NextResponse.json(data, { status: backendResponse.status })
    }

    console.log(`[PROXY] Auth status: ${data.authenticated ? 'authenticated' : 'not authenticated'}`)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Failed to proxy auth status request:', error)
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    )
  }
}