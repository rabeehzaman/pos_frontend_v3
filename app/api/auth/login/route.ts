import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('\n========== AUTH LOGIN CHECK (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    console.log(`[PROXY] Checking auth status from backend: ${backendUrl}/auth/status`)

    // Check backend auth status first
    const backendResponse = await fetch(`${backendUrl}/auth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await backendResponse.json()

    if (!backendResponse.ok) {
      console.error('[PROXY] Backend auth error:', data)
      return NextResponse.json(data, { status: backendResponse.status })
    }

    if (data.authenticated) {
      console.log('[PROXY] Backend is already authenticated')
      return NextResponse.json({ 
        message: 'Already authenticated', 
        authenticated: true,
        ...data 
      })
    }

    console.log('[PROXY] Backend not authenticated - manual setup required')
    return NextResponse.json({
      error: 'Backend authentication required',
      message: 'Please authenticate the backend with Zoho Books first'
    }, { status: 401 })

  } catch (error) {
    console.error('❌ Failed to check backend auth status:', error)
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    )
  }
}