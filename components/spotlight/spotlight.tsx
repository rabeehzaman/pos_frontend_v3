'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { 
  Search,
  ShoppingCart, 
  Calculator,
  Settings,
  User,
  FileText,
  Zap,
  Package
} from 'lucide-react'
import { Product, Customer } from '@/lib/stores/pos-store'
import { useGlobalSearch } from '@/lib/hooks/use-debounced-search'


interface SpotlightProps {
  products?: Product[]
  customers?: Customer[]
  onAddToCart?: (product: Product, quantity?: number) => void
  onNavigate?: (path: string) => void
  onAction?: (action: string, data?: unknown) => void
}

export function Spotlight({ 
  products = [], 
  customers = [], 
  onAddToCart, 
  onNavigate, 
  onAction 
}: SpotlightProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'default' | 'action' | 'nav' | 'calc'>('default')

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space to open (both Mac and Windows)
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault()
        setOpen(!open)
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setOpen(false)
      }
      
      // Alternative shortcut (Ctrl+K)
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Detect command mode based on input
  useEffect(() => {
    if (search.startsWith('>')) {
      setMode('action')
    } else if (search.startsWith('/')) {
      setMode('nav')
    } else if (search.match(/^\d+[\+\-\*\/\%\s]+\d+/) || search.match(/^\d+\s*[\+\-\*\/\%]/)) {
      setMode('calc')
    } else {
      setMode('default')
    }
  }, [search])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setSearch('')
      setMode('default')
    }
  }, [])

  const handleSelect = useCallback((value: string) => {
    const [type, ...data] = value.split(':')
    
    switch (type) {
      case 'product':
        const productId = data[0]
        const product = products.find(p => p.id === productId)
        if (product && onAddToCart) {
          onAddToCart(product)
        }
        break
      
      case 'action':
        if (onAction) {
          onAction(data[0])
        }
        break
      
      case 'nav':
        if (onNavigate) {
          onNavigate(data[0])
        }
        break
      
      case 'customer':
        const customerId = data[0]
        if (onAction) {
          onAction('select-customer', customerId)
        }
        break
      
      case 'calc':
        try {
          const result = eval(data[0])
          navigator.clipboard.writeText(result.toString())
          if (onAction) {
            onAction('calculation', { expression: data[0], result })
          }
        } catch (error) {
          console.error('Calculation error:', error)
        }
        break
    }
    
    setOpen(false)
  }, [products, onAddToCart, onAction, onNavigate])

  // Use debounced global search for instant results
  const { 
    products: searchedProducts, 
    customers: searchedCustomers, 
    isLoading: isSearching 
  } = useGlobalSearch(search && mode === 'default' ? search : '', 100)

  // Fallback to prop-based filtering for backwards compatibility
  const filteredProducts = useMemo(() => {
    if (search && mode === 'default') {
      return searchedProducts.slice(0, 20)
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20)
  }, [products, search, searchedProducts, mode])

  const filteredCustomers = useMemo(() => {
    if (search && mode === 'default') {
      return searchedCustomers.slice(0, 10)
    }
    return customers.filter(customer =>
      customer.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 10)
  }, [customers, search, searchedCustomers, mode])

  const quickActions = [
    { id: 'clear-cart', label: 'Clear Cart', icon: ShoppingCart },
    { id: 'new-invoice', label: 'New Invoice', icon: FileText },
    { id: 'switch-theme', label: 'Switch Theme', icon: Zap },
    { id: 'go-settings', label: 'Open Settings', icon: Settings },
  ]

  const navItems = [
    { path: '/', label: 'POS', icon: Package },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  const getPlaceholder = () => {
    switch (mode) {
      case 'action': return 'Type a command...'
      case 'nav': return 'Where do you want to go?'
      case 'calc': return 'Enter calculation...'
      default: return 'Search products, customers, or type a command...'
    }
  }

  const performCalculation = (expression: string) => {
    try {
      // Simple math evaluation (in production, use a proper math parser)
      const result = eval(expression.replace(/[^0-9+\-*/().\s]/g, ''))
      return result
    } catch {
      return null
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <CommandInput
          placeholder={getPlaceholder()}
          value={search}
          onValueChange={setSearch}
          className="flex-1"
        />
        <Badge variant="outline" className="ml-2 text-xs">
          {mode === 'action' && 'Action'}
          {mode === 'nav' && 'Navigate'}
          {mode === 'calc' && 'Calculate'}
          {mode === 'default' && 'Search'}
        </Badge>
      </div>

      <CommandList className="max-h-96">
        <CommandEmpty>
          {mode === 'calc' && search.match(/[\+\-\*\/\%]/) ? (
            <div className="py-6 text-center">
              <Calculator className="mx-auto h-8 w-8 opacity-50 mb-2" />
              <div className="text-lg font-mono">
                = {performCalculation(search) || 'Invalid expression'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Press Enter to copy result
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Search className="mx-auto h-8 w-8 opacity-50 mb-2" />
              <div>No results found.</div>
              <div className="text-xs text-muted-foreground mt-1">
                Try &quot;&gt;&quot; for actions or &quot;/&quot; for navigation
              </div>
            </div>
          )}
        </CommandEmpty>

        {mode === 'calc' && search.match(/[\+\-\*\/\%]/) && (
          <CommandGroup heading="Calculation">
            <CommandItem
              value={`calc:${search}`}
              onSelect={handleSelect}
              className="flex items-center gap-2"
            >
              <Calculator className="h-4 w-4" />
              <span className="flex-1 font-mono">{search}</span>
              <span className="font-mono text-muted-foreground">
                = {performCalculation(search)}
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {mode === 'action' && (
          <CommandGroup heading="Quick Actions">
            {quickActions
              .filter(action => 
                action.label.toLowerCase().includes(search.slice(1).toLowerCase())
              )
              .map(action => (
                <CommandItem
                  key={action.id}
                  value={`action:${action.id}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </CommandItem>
              ))
            }
          </CommandGroup>
        )}

        {mode === 'nav' && (
          <CommandGroup heading="Navigation">
            {navItems
              .filter(nav => 
                nav.label.toLowerCase().includes(search.slice(1).toLowerCase())
              )
              .map(nav => (
                <CommandItem
                  key={nav.path}
                  value={`nav:${nav.path}`}
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <nav.icon className="h-4 w-4" />
                  {nav.label}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {nav.path}
                  </Badge>
                </CommandItem>
              ))
            }
          </CommandGroup>
        )}

        {mode === 'default' && (
          <>
            {filteredProducts.length > 0 && (
              <CommandGroup heading="Products">
                {filteredProducts.slice(0, 8).map(product => (
                  <CommandItem
                    key={product.id}
                    value={`product:${product.id}`}
                    onSelect={handleSelect}
                    className="flex items-center gap-3"
                  >
                    <Package className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {product.sku} • Stock: {product.stock}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {product.price.toFixed(2)}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredCustomers.length > 0 && (
              <CommandGroup heading="Customers">
                {filteredCustomers.slice(0, 5).map(customer => (
                  <CommandItem
                    key={customer.contact_id}
                    value={`customer:${customer.contact_id}`}
                    onSelect={handleSelect}
                    className="flex items-center gap-3"
                  >
                    <User className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{customer.contact_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {customer.email || 'No email'}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {search === '' && (
              <CommandGroup heading="Quick Actions">
                <CommandItem
                  value="action:clear-cart"
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Clear Cart
                </CommandItem>
                <CommandItem
                  value="nav:/settings"
                  onSelect={handleSelect}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Open Settings
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      <div className="border-t px-3 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Ctrl+Space to search</span>
            <span>{">"} for actions</span>
            <span>/ for navigation</span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </CommandDialog>
  )
}

// Hook for using Spotlight globally
export function useSpotlight() {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return { isOpen, toggle, open, close }
}