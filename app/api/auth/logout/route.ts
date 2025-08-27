import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('\n========== AUTH LOGOUT (PROXY) ==========')

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    console.log(`[PROXY] Attempting logout with backend: ${backendUrl}/auth/logout`)

    // Try to logout from backend if endpoint exists
    try {
      const backendResponse = await fetch(`${backendUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (backendResponse.ok) {
        const data = await backendResponse.json()
        console.log('[PROXY] Backend logout successful')
        return NextResponse.json(data)
      } else {
        console.log('[PROXY] Backend logout endpoint not available or failed')
      }
    } catch (backendError) {
      console.log('[PROXY] Backend logout not available, proceeding with local logout')
    }

    // Local logout (clear any local session data if needed)
    console.log('[PROXY] Performing local logout')
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('❌ Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}