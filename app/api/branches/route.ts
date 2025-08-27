import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('\n========== FETCHING BRANCHES (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    console.log(`[PROXY] Forwarding to backend: ${backendUrl}/api/branches`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/api/branches`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      console.error('[PROXY] Backend error:', data)
      return NextResponse.json(data, { status: backendResponse.status })
    }

    console.log(`[PROXY] Successfully fetched ${data.branches?.length || 0} branches from backend`)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Failed to proxy branches request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch branches from backend' },
      { status: 500 }
    )
  }
}