'use client'

import { useEffect, useState, useCallback } from 'react'
import { Header } from '@/components/header'
import { ProductGrid } from '@/components/pos/product-grid'
import { CartSidebarWrapper } from '@/components/pos/cart-sidebar-wrapper'
import { Spotlight } from '@/components/spotlight/spotlight'
import { Product, Customer } from '@/lib/stores/pos-store'
import { useDebounce } from '@/lib/hooks/use-debounced-search'
import { 
  useCartActions, 
  useDataActions,
  useCartSummary,
  useCustomerSelection 
} from '@/lib/hooks/use-shallow-store'
import { useCachedProducts, useCachedCustomers } from '@/lib/hooks/use-cached-data'
import { toast } from 'sonner'

export function POSPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 200)
  const [isOnline, setIsOnline] = useState(true)

  // Monitor online status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  // Use cached data hooks with long cache duration for POS
  const { 
    products, 
    isLoading: isLoadingProducts, 
    error: productsError,
    syncStatus: productsSyncStatus,
    forceSync: forceProductsSync
  } = useCachedProducts({
    maxAge: 24 * 60 * 60 * 1000, // 24 hours for items
    staleTime: 60 * 60 * 1000, // 1 hour before considered stale
    enableBackgroundSync: true,
    retryOnError: true
  })

  const { 
    customers, 
    isLoading: isLoadingCustomers, 
    error: customersError,
    syncStatus: customersSyncStatus,
    forceSync: forceCustomersSync
  } = useCachedCustomers({
    maxAge: 12 * 60 * 60 * 1000, // 12 hours for customers
    staleTime: 60 * 60 * 1000, // 1 hour before considered stale
    enableBackgroundSync: true,
    retryOnError: true
  })

  const { addToCart, clearCart } = useCartActions()
  const { setProducts, setCustomers } = useDataActions()
  const { setSelectedCustomer } = useCustomerSelection()
  const { cartCount } = useCartSummary()

  // Sync products and customers to Zustand store when cache updates
  useEffect(() => {
    if (products.length > 0) {
      setProducts(products)
    }
  }, [products])

  useEffect(() => {
    if (customers.length > 0) {
      setCustomers(customers)
    }
  }, [customers])

  // Show error toasts for failed syncs
  useEffect(() => {
    if (productsError) {
      toast.error('Failed to sync products. Using cached data.')
    }
  }, [productsError])

  useEffect(() => {
    if (customersError) {
      toast.error('Failed to sync customers. Using cached data.')
    }
  }, [customersError])

  const handleSpotlightAddToCart = useCallback((product: Product, quantity = 1, unit?: string, customPrice?: number) => {
    addToCart(product, quantity, unit, customPrice)
    toast.success(`Added ${product.name} to cart`)
  }, [addToCart])

  const handleSpotlightAction = useCallback((action: string, data?: unknown) => {
    switch (action) {
      case 'clear-cart':
        clearCart()
        toast.success('Cart cleared')
        break
      case 'new-invoice':
        toast.info('Invoice creation not implemented yet')
        break
      case 'refresh-data':
        // Force refresh both products and customers
        forceProductsSync()
        forceCustomersSync()
        toast.info('Refreshing data from server...')
        break
      case 'switch-theme':
        // Theme switching is handled by the header
        break
      case 'calculation': {
        const calculationData = data as { result: number }
        toast.success(`Calculation result: ${calculationData.result}`)
        break
      }
      case 'select-customer': {
        const customerId = data as string
        const customer = customers.find(c => c.contact_id === customerId)
        if (customer) {
          setSelectedCustomer(customerId)
          toast.success(`Selected customer: ${customer.contact_name}`)
        }
        break
      }
      default:
        console.log('Unknown action:', action)
    }
  }, [clearCart, customers, setSelectedCustomer, forceProductsSync, forceCustomersSync])

  const handleSpotlightNavigate = useCallback((path: string) => {
    window.location.href = path
  }, [])

  return (
    <div className="flex flex-col h-screen">
      <Header 
        cartCount={cartCount} 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        syncStatus={(productsSyncStatus === 'syncing' || customersSyncStatus === 'syncing') ? 'syncing' : 
                   (productsSyncStatus === 'error' || customersSyncStatus === 'error') ? 'error' : 'idle'}
        isOnline={isOnline}
      />
      
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          <ProductGrid 
            products={products}
            onAddToCart={handleSpotlightAddToCart}
            searchQuery={debouncedSearchQuery}
            isLoading={isLoadingProducts}
          />
        </div>
        
        <CartSidebarWrapper />
      </main>

      <Spotlight 
        products={products}
        customers={customers}
        onAddToCart={handleSpotlightAddToCart}
        onAction={handleSpotlightAction}
        onNavigate={handleSpotlightNavigate}
      />
    </div>
  )
}