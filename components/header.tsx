'use client'

import React from 'react'
import { Settings, Moon, Sun, Search, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  cartCount?: number
  searchQuery?: string
  onSearchChange?: (query: string) => void
  syncStatus?: 'idle' | 'syncing' | 'error'
  isOnline?: boolean
}

export const Header = React.memo<HeaderProps>(function Header({ 
  cartCount = 0, 
  searchQuery = '', 
  onSearchChange, 
  syncStatus = 'idle',
  isOnline = true 
}) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const goToSettings = () => {
    router.push('/settings')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container flex h-12 items-center justify-between px-4">
        {/* Left: Logo/Title */}
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-medium tracking-tight">TMR POS</h1>
          {cartCount > 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
              {cartCount}
            </Badge>
          )}
          {/* Sync Status Indicator */}
          {syncStatus === 'syncing' && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
          {syncStatus === 'error' && !isOnline && (
            <div className="flex items-center space-x-1 text-xs text-yellow-600 dark:text-yellow-500">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          )}
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-sm mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-10 h-9 border-0 bg-muted/30 hover:bg-muted/50 focus:bg-background/80 transition-all duration-200 rounded-full text-sm placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full hover:bg-muted/50 transition-colors"
            title="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goToSettings}
            className="h-8 w-8 rounded-full hover:bg-muted/50 transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  )
})