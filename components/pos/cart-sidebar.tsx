'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trash2, Plus, Minus, ShoppingCart, User, DollarSign, Clock } from 'lucide-react'
import { CartItem, Customer } from '@/lib/stores/pos-store'

interface CartSidebarProps {
  cart: CartItem[]
  customers: Customer[]
  selectedCustomer: string | null
  taxMode: 'inclusive' | 'exclusive'
  onUpdateQuantity: (id: string, unit: string, quantity: number) => void
  onRemoveItem: (id: string, unit: string) => void
  onSelectCustomer: (customerId: string | null) => void
  onCheckout: () => void
  onClearCart: () => void
  isLoading?: boolean
}

export function CartSidebar({
  cart = [],
  customers = [],
  selectedCustomer,
  taxMode,
  onUpdateQuantity,
  onRemoveItem,
  onSelectCustomer,
  onCheckout,
  onClearCart,
  isLoading = false,
}: CartSidebarProps) {
  const [customerSearch, setCustomerSearch] = useState('')

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer =>
    customer.contact_name.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 10) // Limit to 10 results

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
  const taxRate = 0.15 // 15% VAT
  const taxAmount = taxMode === 'exclusive' ? subtotal * taxRate : 0
  const total = subtotal + taxAmount

  const selectedCustomerData = customers.find(c => c.contact_id === selectedCustomer)

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Cart ({cart.length})
        </CardTitle>
      </CardHeader>

      {/* Customer Selection */}
      <div className="px-6 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Customer
          </div>
          
          <Input
            placeholder="Search customers..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="text-sm"
          />
          
          {customerSearch && (
            <ScrollArea className="max-h-32 border rounded">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.contact_id}
                  className="p-2 hover:bg-muted cursor-pointer text-sm"
                  onClick={() => {
                    onSelectCustomer(customer.contact_id)
                    setCustomerSearch('')
                  }}
                >
                  {customer.contact_name}
                  {customer.email && (
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  )}
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="p-2 text-sm text-muted-foreground">No customers found</div>
              )}
            </ScrollArea>
          )}
          
          {selectedCustomerData && (
            <div className="flex items-center justify-between bg-muted p-2 rounded">
              <div>
                <div className="text-sm font-medium">{selectedCustomerData.contact_name}</div>
                {selectedCustomerData.email && (
                  <div className="text-xs text-muted-foreground">{selectedCustomerData.email}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectCustomer(null)}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Cart Items */}
      <div className="flex-1 overflow-hidden">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2">Cart is empty</h3>
            <p className="text-sm text-muted-foreground">Add products to start building your order</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {cart.map((item) => (
                <Card key={`${item.id}-${item.unit}`} className="border border-border/50">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {/* Item Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.unit}
                            </Badge>
                            {item.pricingSource === 'lastSold' && (
                              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Last Sold
                              </Badge>
                            )}
                          </div>
                          {item.lastSoldDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.lastSoldDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => onRemoveItem(item.id, item.unit)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onUpdateQuantity(item.id, item.unit, Math.max(1, item.qty - 1))}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.qty}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onUpdateQuantity(item.id, item.unit, item.qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {(item.price * item.qty).toFixed(2)} SAR
                          </div>
                          <div className="text-xs text-muted-foreground">
                            @ {item.price.toFixed(2)} SAR
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer with totals and actions */}
      {cart.length > 0 && (
        <>
          <Separator />
          <div className="p-4 space-y-4">
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{subtotal.toFixed(2)} SAR</span>
              </div>
              
              {taxMode === 'exclusive' && (
                <div className="flex justify-between text-sm">
                  <span>VAT (15%):</span>
                  <span>{taxAmount.toFixed(2)} SAR</span>
                </div>
              )}
              
              <Separator />
              <div className="flex justify-between text-base font-medium">
                <span>Total:</span>
                <span>{total.toFixed(2)} SAR</span>
              </div>
              
              {taxMode === 'inclusive' && (
                <div className="text-xs text-muted-foreground">
                  (Includes VAT of {(subtotal * taxRate / 1.15).toFixed(2)} SAR)
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button 
                onClick={onCheckout} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : `Checkout ${total.toFixed(2)} SAR`}
              </Button>
              <Button 
                variant="outline" 
                onClick={onClearCart}
                className="w-full"
                disabled={isLoading}
              >
                Clear Cart
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}