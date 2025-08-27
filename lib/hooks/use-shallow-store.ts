'use client'

import { useMemo } from 'react'
import { usePOSStore } from '../stores/pos-store'

// Optimized selectors using shallow comparison to prevent unnecessary re-renders

// Use direct selectors without shallow for arrays (arrays are reference stable in Zustand)
export const useProducts = () => usePOSStore(state => state.products)
export const useCustomers = () => usePOSStore(state => state.customers)  
export const useCart = () => usePOSStore(state => state.cart)

// Actions are stable in Zustand, so we can access them directly without shallow comparison
export const useCartActions = () => {
  const addToCart = usePOSStore(state => state.addToCart)
  const updateCartItem = usePOSStore(state => state.updateCartItem)
  const removeFromCart = usePOSStore(state => state.removeFromCart)
  const clearCart = usePOSStore(state => state.clearCart)

  return useMemo(() => ({
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
  }), [addToCart, updateCartItem, removeFromCart, clearCart])
}

// Use shallow comparison for settings state (values can change)
export const useSettings = () => {
  const taxMode = usePOSStore(state => state.taxMode)
  const selectedBranch = usePOSStore(state => state.selectedBranch)
  const invoiceMode = usePOSStore(state => state.invoiceMode)
  const printerSettings = usePOSStore(state => state.printerSettings)

  return useMemo(() => ({
    taxMode,
    selectedBranch,
    invoiceMode,
    printerSettings,
  }), [taxMode, selectedBranch, invoiceMode, printerSettings])
}

// Actions are stable in Zustand, so we can access them directly
export const useSettingsActions = () => {
  const setTaxMode = usePOSStore(state => state.setTaxMode)
  const setSelectedBranch = usePOSStore(state => state.setSelectedBranch)
  const setInvoiceMode = usePOSStore(state => state.setInvoiceMode)
  const setPrinterSettings = usePOSStore(state => state.setPrinterSettings)

  return useMemo(() => ({
    setTaxMode,
    setSelectedBranch,
    setInvoiceMode,
    setPrinterSettings,
  }), [setTaxMode, setSelectedBranch, setInvoiceMode, setPrinterSettings])
}

// Use shallow comparison for customer selection (includes both state and action)
export const useCustomerSelection = () => {
  const selectedCustomer = usePOSStore(state => state.selectedCustomer)
  const setSelectedCustomer = usePOSStore(state => state.setSelectedCustomer)

  return useMemo(() => ({
    selectedCustomer,
    setSelectedCustomer,
  }), [selectedCustomer, setSelectedCustomer])
}

// Actions are stable in Zustand, so we can access them directly
export const useDataActions = () => {
  const setProducts = usePOSStore(state => state.setProducts)
  const setCustomers = usePOSStore(state => state.setCustomers)

  return useMemo(() => ({
    setProducts,
    setCustomers,
  }), [setProducts, setCustomers])
}

// Use shallow comparison for UI state (values can change)
export const useUIState = () => {
  const loading = usePOSStore(state => state.loading)
  const syncStatus = usePOSStore(state => state.syncStatus)

  return useMemo(() => ({
    loading,
    syncStatus,
  }), [loading, syncStatus])
}

// Actions are stable in Zustand, so we can access them directly
export const useUIActions = () => {
  const setLoading = usePOSStore(state => state.setLoading)
  const setSyncStatus = usePOSStore(state => state.setSyncStatus)

  return useMemo(() => ({
    setLoading,
    setSyncStatus,
  }), [setLoading, setSyncStatus])
}

// Cart computed values with proper memoization to prevent infinite loops
export const useCartSummary = () => {
  const cart = usePOSStore(state => state.cart)
  const taxMode = usePOSStore(state => state.taxMode)
  
  return useMemo(() => {
    const cartCount = cart.reduce((total, item) => total + item.qty, 0)
    const subtotal = cart.reduce((total, item) => total + (item.price * item.qty), 0)
    
    const TAX_RATE = 0.15
    const tax = taxMode === 'inclusive' 
      ? subtotal * (TAX_RATE / (1 + TAX_RATE))
      : subtotal * TAX_RATE
    const total = taxMode === 'inclusive' ? subtotal : subtotal + tax
    
    return { cartCount, subtotal, tax, total, taxMode }
  }, [cart, taxMode])
}