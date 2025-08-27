import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('\n========== FETCHING INVOICES (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    // Get query parameters from the request
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    
    console.log(`[PROXY] Forwarding to backend: ${backendUrl}/api/invoices${queryString ? '?' + queryString : ''}`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/api/invoices${queryString ? '?' + queryString : ''}`, {
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

    console.log(`[PROXY] Successfully fetched ${data.invoices?.length || 0} invoices from backend`)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Failed to proxy invoices GET request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices from backend' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('\n========== CREATING INVOICE (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    // Get the request body
    const body = await request.json()
    
    console.log(`[PROXY] Forwarding POST to backend: ${backendUrl}/api/invoices`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/api/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      console.error('[PROXY] Backend error:', data)
      return NextResponse.json(data, { status: backendResponse.status })
    }

    console.log(`[PROXY] Successfully created invoice: ${data.invoice?.invoice_number || 'Unknown'}`)

    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Failed to proxy invoice POST request:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice via backend' },
      { status: 500 }
    )
  }
}