'use client'

import { useEffect, useState } from 'react'

interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * A component that only renders its children on the client-side.
 * This prevents hydration mismatches when using client-only features
 * like localStorage, Zustand persist, etc.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)
  
  useEffect(() => {
    setHasMounted(true)
  }, [])
  
  if (!hasMounted) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}