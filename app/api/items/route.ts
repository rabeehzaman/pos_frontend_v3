import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('\n========== FETCHING ITEMS (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    
    console.log(`[PROXY] Forwarding to backend: ${backendUrl}/api/items${queryString ? '?' + queryString : ''}`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/api/items${queryString ? '?' + queryString : ''}`, {
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

    console.log(`[PROXY] Successfully fetched ${data.items?.length || 0} items from backend`)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Failed to proxy items request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items from backend' },
      { status: 500 }
    )
  }
}