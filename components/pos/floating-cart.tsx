'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  CreditCard,
  X
} from 'lucide-react'
import { usePOSStore } from '@/lib/stores/pos-store'
import { toast } from 'sonner'

const TAX_RATE = 0.15 // 15% VAT

export function FloatingCart() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { 
    cart, 
    updateCartItem, 
    removeFromCart, 
    clearCart, 
    taxMode,
    customers,
    selectedCustomer,
    selectedBranch
  } = usePOSStore()

  const cartCount = cart.reduce((total, item) => total + item.qty, 0)
  const subtotal = cart.reduce((total, item) => total + (item.price * item.qty), 0)
  const tax = taxMode === 'inclusive' 
    ? subtotal * (TAX_RATE / (1 + TAX_RATE))
    : subtotal * TAX_RATE
  const total = taxMode === 'inclusive' ? subtotal : subtotal + tax

  const handleUpdateQuantity = (id: string, unit: string, delta: number) => {
    const item = cart.find(i => i.id === id && i.unit === unit)
    if (item) {
      const newQty = Math.max(1, item.qty + delta)
      updateCartItem(id, { qty: newQty })
    }
  }

  const handleRemoveItem = (id: string, unit: string) => {
    removeFromCart(id, unit)
    toast.success('Item removed from cart')
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    
    if (!selectedCustomer) {
      toast.error('Please select a customer first')
      return
    }

    try {
      const lineItems = cart.map(item => ({
        item_id: item.id,
        quantity: item.qty,
        rate: item.price,
        unit: item.unit,
        tax_id: item.tax_id || '',
      }))

      // Check if Main Branch is selected for template
      const templateData = selectedBranch?.name === "Main Branch" 
        ? {
            template_id: "9465000000093250",
            template_name: "MASTER",
            template_type: "custom"
          }
        : {}

      const invoiceData = {
        customer_id: selectedCustomer,
        line_items: lineItems,
        is_inclusive_tax: taxMode === 'inclusive',
        branch_id: selectedBranch?.id || null,
        ...templateData
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Invoice ${result.invoice.invoice_number} created successfully!`)
        clearCart()
        setIsExpanded(false)
      } else {
        toast.error('Failed to create invoice')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Failed to create invoice')
    }
  }

  const selectedCustomerData = customers.find(c => c.contact_id === selectedCustomer)

  if (cart.length === 0) {
    return null
  }

  return (
    <>
      {/* Floating Cart Button (Minimized) */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsExpanded(true)}
              size="lg"
              className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl relative"
            >
              <ShoppingCart className="h-6 w-6" />
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold"
              >
                {cartCount}
              </Badge>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Cart */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsExpanded(false)}
            />

            {/* Cart Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md z-50"
            >
              <Card className="h-full rounded-none border-l shadow-2xl">
                {/* Header */}
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Cart ({cartCount})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(false)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Customer Selection */}
                  <div className="text-sm">
                    {selectedCustomerData ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Customer:</span>
                        <Badge variant="outline">{selectedCustomerData.contact_name}</Badge>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        No customer selected - use Ctrl+Space to find customers
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* Cart Items */}
                <CardContent className="flex-1 overflow-auto p-0">
                  <div className="p-4 space-y-3">
                    {cart.map((item, index) => (
                      <div key={`${item.id}-${item.unit}`} className="space-y-3">
                        <Card>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">
                                  {item.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  ${item.price.toFixed(2)} × {item.qty} ({item.unit})
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id, item.unit)}
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUpdateQuantity(item.id, item.unit, -1)}
                                  className="h-6 w-6"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">
                                  {item.qty}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleUpdateQuantity(item.id, item.unit, 1)}
                                  className="h-6 w-6"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div className="font-semibold">
                                ${(item.price * item.qty).toFixed(2)}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        {index < cart.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                </CardContent>

                {/* Footer - Totals & Checkout */}
                <div className="border-t bg-muted/10 p-4 space-y-4">
                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>VAT (15%){taxMode === 'inclusive' ? ' (included)' : ''}</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearCart}
                      className="flex-1"
                    >
                      Clear All
                    </Button>
                    <Button
                      onClick={handleCheckout}
                      disabled={!selectedCustomer}
                      className="flex-1"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Checkout
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}