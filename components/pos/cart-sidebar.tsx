'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  CreditCard,
  Search,
  User,
  Printer,
  Download
} from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { downloadInvoiceWithDelay, downloadInvoice, downloadAndPrintInvoice } from '@/lib/utils/invoice-download'
import { 
  useCart, 
  useCartActions, 
  useCustomers, 
  useSettings, 
  useSettingsActions,
  useCustomerSelection, 
  useCartSummary 
} from '@/lib/hooks/use-shallow-store'

const TAX_RATE = 0.15 // 15% VAT

interface LastInvoice {
  invoice_id: string
  invoice_number: string
  total: string | number
  status: string
  isDraft: boolean
}

export const CartSidebar = React.memo(function CartSidebar() {
  const [customerSearch, setCustomerSearch] = useState('')
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null)
  const cartScrollRef = useRef<HTMLDivElement>(null)
  const prevCartLength = useRef(0)
  
  // Use optimized selectors to prevent infinite loops
  const cart = useCart()
  const { updateCartItem, removeFromCart, clearCart } = useCartActions()
  const { taxMode, invoiceMode, selectedBranch } = useSettings()
  const { setInvoiceMode } = useSettingsActions()
  const customers = useCustomers()
  const { selectedCustomer, setSelectedCustomer } = useCustomerSelection()
  const { cartCount, subtotal, tax, total } = useCartSummary()

  // Auto-scroll when new items are added
  useEffect(() => {
    if (cart.length > prevCartLength.current && cartScrollRef.current) {
      cartScrollRef.current.scrollTo({
        top: cartScrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
    prevCartLength.current = cart.length
  }, [cart.length])

  // Cart calculations now come from useCartSummary hook

  const filteredCustomers = useMemo(() => 
    customers.filter(customer =>
      customer.contact_name.toLowerCase().includes(customerSearch.toLowerCase())
    ).slice(0, 5), 
    [customers, customerSearch]
  )

  const handleUpdateQuantity = useCallback((id: string, unit: string, delta: number) => {
    const item = cart.find(i => i.id === id && i.unit === unit)
    if (item) {
      const newQty = Math.max(1, item.qty + delta)
      updateCartItem(id, { qty: newQty })
    }
  }, [cart, updateCartItem])

  const handleRemoveItem = useCallback((id: string, unit: string) => {
    removeFromCart(id, unit)
    toast.success('Item removed from cart')
  }, [removeFromCart])

  const handleClearCart = useCallback(() => {
    clearCart()
    setLastInvoice(null)
  }, [clearCart])

  const handleDownloadLastInvoice = async () => {
    if (!lastInvoice) return
    
    await downloadInvoice({
      invoiceId: lastInvoice.invoice_id,
      invoiceNumber: lastInvoice.invoice_number,
      isDraft: lastInvoice.isDraft
    })
  }

  const handlePrintLastInvoice = async () => {
    if (!lastInvoice) return
    
    await downloadAndPrintInvoice({
      invoiceId: lastInvoice.invoice_id,
      invoiceNumber: lastInvoice.invoice_number,
      isDraft: lastInvoice.isDraft,
      autoPrint: true,
      skipDownload: true
    })
  }

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomer(customerId)
    setCustomerSearch('')
    const customer = customers.find(c => c.contact_id === customerId)
    if (customer) {
      toast.success(`Selected: ${customer.contact_name}`)
    }
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
        mark_as_sent: invoiceMode === 'sent',
        ...templateData
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      })

      const result = await response.json()

      if (result.success) {
        const statusMessage = invoiceMode === 'sent' 
          ? `Invoice ${result.invoice.invoice_number} sent successfully!`
          : `Draft invoice ${result.invoice.invoice_number} created successfully!`
        toast.success(statusMessage)
        
        // Store last invoice for re-download option
        setLastInvoice({
          invoice_id: result.invoice.invoice_id,
          invoice_number: result.invoice.invoice_number,
          total: result.invoice.total,
          status: result.invoice.status,
          isDraft: invoiceMode === 'draft'
        })
        
        // Auto-download and print the invoice PDF after a short delay
        setTimeout(() => {
          downloadAndPrintInvoice({
            invoiceId: result.invoice.invoice_id,
            invoiceNumber: result.invoice.invoice_number,
            isDraft: invoiceMode === 'draft',
            autoPrint: true, // Enable auto-print based on settings
            skipDownload: false
          })
        }, 2000)
        
        clearCart()
        setSelectedCustomer(null)
      } else {
        toast.error('Failed to create invoice')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Failed to create invoice')
    }
  }

  const selectedCustomerData = customers.find(c => c.contact_id === selectedCustomer)

  return (
    <div className="w-[28rem] border-l border-border/40 bg-background/50 backdrop-blur-sm flex flex-col h-full">
      {/* Customer Search */}
      <div className="p-4 border-b border-border/30">
        <div className="relative mb-3">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            type="text"
            placeholder="Search customers..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="pl-10 h-9 border-0 bg-muted/30 hover:bg-muted/50 focus:bg-background/80 transition-all duration-200 rounded-full text-sm"
          />
        </div>

        {/* Customer Selection */}
        {selectedCustomerData ? (
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
            <div>
              <p className="text-sm font-medium">{selectedCustomerData.contact_name}</p>
              <p className="text-xs text-muted-foreground">Selected Customer</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedCustomer(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        ) : customerSearch && filteredCustomers.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {filteredCustomers.map(customer => (
              <button
                key={customer.contact_id}
                onClick={() => handleSelectCustomer(customer.contact_id)}
                className="w-full text-left p-2 hover:bg-muted/50 rounded-lg transition-colors text-sm"
              >
                {customer.contact_name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Cart Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="font-medium">Cart</h2>
            {cartCount > 0 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
                {cartCount}
              </Badge>
            )}
          </div>
          {cart.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearCart}
              className="text-xs h-7"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div ref={cartScrollRef} className="flex-1 overflow-auto p-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Add items to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {cart.map((item) => (
              <div key={`${item.id}-${item.unit}`} className="py-2">
                {/* First row: name and controls */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1 leading-tight">
                      {item.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleUpdateQuantity(item.id, item.unit, -1)}
                      disabled={item.qty <= 1}
                      className="h-5 w-5"
                    >
                      <Minus className="h-2 w-2" />
                    </Button>
                    <span className="text-xs font-medium w-6 text-center">
                      {item.qty}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleUpdateQuantity(item.id, item.unit, 1)}
                      className="h-5 w-5"
                    >
                      <Plus className="h-2 w-2" />
                    </Button>
                    <div className="text-sm font-semibold ml-2">
                      {(item.price * item.qty).toFixed(2)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id, item.unit)}
                      className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive ml-1"
                    >
                      <Trash2 className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
                {/* Second row: price per unit */}
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground/70">
                    {item.price.toFixed(2)} per {item.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Invoice */}
      {lastInvoice && cart.length === 0 && (
        <div className="p-4 border-t border-border/30">
          <Card className="bg-emerald-50/50 border-emerald-200/50">
            <CardContent className="p-4">
              <div className="text-center space-y-3">
                <div>
                  <Badge variant="outline" className="bg-emerald-100/50 text-emerald-700 border-emerald-200">
                    {lastInvoice.isDraft ? 'Draft Created' : 'Invoice Sent'}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-medium text-emerald-900">
                    {lastInvoice.isDraft ? 'Draft' : 'Invoice'} {lastInvoice.invoice_number}
                  </h3>
                  <p className="text-sm text-emerald-700">
                    Total: {typeof lastInvoice.total === 'number' ? lastInvoice.total.toFixed(2) : lastInvoice.total} SAR
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadLastInvoice}
                    size="sm"
                    className="flex-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    onClick={handlePrintLastInvoice}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Printer className="w-3 h-3 mr-1" />
                    Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="p-4 border-t border-border/30 bg-background/80">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax ({Math.round(TAX_RATE * 100)}%):</span>
              <span>{tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Invoice Mode Toggle */}
          <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Send Invoice</span>
              <span className="text-xs text-muted-foreground">
                {invoiceMode === 'sent' 
                  ? 'Invoice will be sent immediately' 
                  : 'Save as draft for later review'}
              </span>
            </div>
            <Switch
              checked={invoiceMode === 'sent'}
              onCheckedChange={(checked) => setInvoiceMode(checked ? 'sent' : 'draft')}
            />
          </div>

          <Button 
            onClick={handleCheckout}
            className="w-full"
            disabled={!selectedCustomer}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {invoiceMode === 'sent' ? 'Send Invoice' : 'Create Draft'}
          </Button>
        </div>
      )}
    </div>
  )
})