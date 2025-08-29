'use client'

import { useCallback } from 'react'
import { CartSidebar } from './cart-sidebar'
import { 
  useCart, 
  useCustomers, 
  useCustomerSelection, 
  useCartActions,
  useSettings 
} from '@/lib/hooks/use-shallow-store'
import { usePOSStore } from '@/lib/stores/pos-store'
import { toast } from 'sonner'

export function CartSidebarWrapper() {
  const cart = useCart()
  const customers = useCustomers()
  const { selectedCustomer, setSelectedCustomer } = useCustomerSelection()
  const { taxMode, selectedBranch } = useSettings()
  const { updateCartItem, removeFromCart, clearCart } = useCartActions()
  
  const handleUpdateQuantity = useCallback((id: string, unit: string, quantity: number) => {
    updateCartItem(id, { qty: quantity })
  }, [updateCartItem])

  const handleRemoveItem = useCallback((id: string, unit: string) => {
    removeFromCart(id, unit)
  }, [removeFromCart])

  const handleSelectCustomer = useCallback((customerId: string | null) => {
    setSelectedCustomer(customerId)
  }, [setSelectedCustomer])

  const handleClearCart = useCallback(() => {
    clearCart()
    toast.success('Cart cleared')
  }, [clearCart])

  // Save custom prices to Supabase when checkout is performed
  const saveCustomPricesToSupabase = useCallback(async () => {
    if (!selectedBranch) {
      console.warn('No branch selected - cannot save prices')
      return
    }

    const customPricedItems = cart.filter(item => 
      item.customPrice && item.customPrice !== item.originalPrice
    )

    if (customPricedItems.length === 0) {
      console.log('No custom priced items to save')
      return
    }

    console.log(`[PRICING] Saving ${customPricedItems.length} custom prices to Supabase`)

    const savePromises = customPricedItems.map(async (item) => {
      try {
        const response = await fetch('/api/pos/save-last-sold-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.id,
            branch_id: selectedBranch.id,
            unit: item.unit,
            price: item.customPrice || item.price,
            tax_mode: taxMode,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        if (data.success) {
          console.log(`[PRICING] Saved price for ${item.name}: ${item.customPrice} SAR`)
        } else {
          console.error(`[PRICING] Failed to save price for ${item.name}:`, data.error)
        }
      } catch (error) {
        console.error(`[PRICING] Error saving price for ${item.name}:`, error)
      }
    })

    await Promise.all(savePromises)
  }, [cart, selectedBranch, taxMode])

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    try {
      // Save custom prices to Supabase first
      await saveCustomPricesToSupabase()
      
      // TODO: Implement actual checkout flow (create invoice in Zoho Books)
      toast.info('Checkout not fully implemented yet. Custom prices have been saved.')
      
      // For now, just clear the cart after saving prices
      clearCart()
      toast.success('Custom prices saved successfully')
      
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Checkout failed. Please try again.')
    }
  }, [cart, saveCustomPricesToSupabase, clearCart])

  return (
    <CartSidebar
      cart={cart}
      customers={customers}
      selectedCustomer={selectedCustomer}
      taxMode={taxMode}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      onSelectCustomer={handleSelectCustomer}
      onCheckout={handleCheckout}
      onClearCart={handleClearCart}
      isLoading={false}
    />
  )
}