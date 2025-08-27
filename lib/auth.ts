// Authentication utilities for Zoho Books OAuth integration
import Cookies from 'js-cookie'

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
  organizationId: string
}

export interface AuthStatus {
  authenticated: boolean
  tokenExpiresIn?: number
  tokenExpiresInHours?: number
  organizationId?: string
  needsReauth: boolean
  critical: boolean
  status: 'not_authenticated' | 'good' | 'warning' | 'critical'
  message: string
}

// Token storage keys
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'zoho_access_token',
  REFRESH_TOKEN: 'zoho_refresh_token',
  EXPIRES_AT: 'zoho_expires_at',
  ORGANIZATION_ID: 'zoho_org_id'
} as const

// Get stored tokens from cookies/localStorage
export function getStoredTokens(): TokenData | null {
  try {
    const accessToken = Cookies.get(TOKEN_KEYS.ACCESS_TOKEN)
    const refreshToken = Cookies.get(TOKEN_KEYS.REFRESH_TOKEN)
    const expiresAt = Cookies.get(TOKEN_KEYS.EXPIRES_AT)
    const organizationId = Cookies.get(TOKEN_KEYS.ORGANIZATION_ID)

    if (!accessToken || !refreshToken || !expiresAt || !organizationId) {
      return null
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt),
      organizationId
    }
  } catch (error) {
    console.error('Error getting stored tokens:', error)
    return null
  }
}

// Store tokens in cookies
export function storeTokens(tokens: TokenData): void {
  try {
    const cookieOptions = {
      expires: 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const
    }

    Cookies.set(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken, cookieOptions)
    Cookies.set(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken, cookieOptions)
    Cookies.set(TOKEN_KEYS.EXPIRES_AT, tokens.expiresAt.toString(), cookieOptions)
    Cookies.set(TOKEN_KEYS.ORGANIZATION_ID, tokens.organizationId, cookieOptions)

    console.log('✅ Tokens stored successfully')
  } catch (error) {
    console.error('Error storing tokens:', error)
  }
}

// Clear stored tokens
export function clearTokens(): void {
  try {
    Object.values(TOKEN_KEYS).forEach(key => {
      Cookies.remove(key)
    })
    console.log('✅ Tokens cleared')
  } catch (error) {
    console.error('Error clearing tokens:', error)
  }
}

// Check if token needs refresh (within 5 minutes of expiry)
export function tokenNeedsRefresh(expiresAt: number): boolean {
  return Date.now() >= (expiresAt - 300000) // 5 minutes buffer
}

// Get auth status
export function getAuthStatus(): AuthStatus {
  const tokens = getStoredTokens()
  const now = Date.now()

  if (!tokens) {
    return {
      authenticated: false,
      needsReauth: true,
      critical: true,
      status: 'not_authenticated',
      message: 'Not authenticated'
    }
  }

  const expiresIn = Math.max(0, Math.floor((tokens.expiresAt - now) / 1000))
  const expiresInHours = (expiresIn / 3600)
  const needsReauth = now >= tokens.expiresAt - (24 * 60 * 60 * 1000) // 24 hours warning
  const critical = now >= tokens.expiresAt - (2 * 60 * 60 * 1000) // 2 hours critical

  let status: AuthStatus['status'] = 'good'
  let message = `Token valid for ${expiresInHours.toFixed(1)}h`

  if (critical) {
    status = 'critical'
    message = `Token expires in ${expiresInHours.toFixed(1)}h - Re-authenticate immediately`
  } else if (needsReauth) {
    status = 'warning'
    message = `Token expires in ${expiresInHours.toFixed(1)}h - Re-authenticate soon`
  }

  return {
    authenticated: true,
    tokenExpiresIn: expiresIn,
    tokenExpiresInHours: parseFloat(expiresInHours.toFixed(1)),
    organizationId: tokens.organizationId,
    needsReauth,
    critical,
    status,
    message
  }
}

// Generate OAuth URL for Zoho
export function generateOAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  const accountsUrl = process.env.NEXT_PUBLIC_ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.sa'

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId || '',
    scope: 'ZohoBooks.fullaccess.all',
    redirect_uri: redirectUri,
    access_type: 'offline',
    prompt: 'consent'
  })

  return `${accountsUrl}/oauth/v2/auth?${params.toString()}`
}

// Refresh access token
export async function refreshAccessToken(): Promise<TokenData | null> {
  try {
    const tokens = getStoredTokens()
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Token refresh failed')
    }

    const newTokens: TokenData = {
      accessToken: data.accessToken,
      refreshToken: tokens.refreshToken, // Keep existing refresh token
      expiresAt: data.expiresAt,
      organizationId: tokens.organizationId
    }

    storeTokens(newTokens)
    return newTokens

  } catch (error) {
    console.error('Token refresh failed:', error)
    clearTokens()
    return null
  }
}

// Ensure valid token (refresh if needed)
export async function ensureValidToken(): Promise<string | null> {
  try {
    const tokens = getStoredTokens()
    if (!tokens) {
      return null
    }

    if (tokenNeedsRefresh(tokens.expiresAt)) {
      console.log('🔄 Token needs refresh, refreshing...')
      const newTokens = await refreshAccessToken()
      return newTokens?.accessToken || null
    }

    return tokens.accessToken
  } catch (error) {
    console.error('Error ensuring valid token:', error)
    return null
  }
}

// Logout function
export async function logout(): Promise<void> {
  try {
    // Call logout API to clear server-side session if needed
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout API call failed:', error)
  } finally {
    // Always clear client-side tokens
    clearTokens()
  }
}