import { create } from 'zustand'
import { PrinterSettings, getPrinterSettings, savePrinterSettings } from '@/lib/utils/printer'

export interface Product {
  id: string
  name: string
  price: number
  stock: number
  sku: string
  group_name?: string
  tax_id?: string
  tax_percentage?: number
  storedUnit?: string
  // Unit conversion properties from backend
  piecePrice?: number
  cartonPrice?: number
  piecesPerCarton?: number
  hasConversion?: boolean
  defaultUnit?: string
}

export interface Customer {
  contact_id: string
  contact_name: string
  contact_persons?: {
    contact_person_id: string
    salutation: string
    first_name: string
    last_name: string
    email: string
    phone: string
  }[]
  email?: string
}

export interface CartItem {
  id: string
  name: string
  price: number
  qty: number
  unit: string
  storedUnit?: string
  tax_id?: string
  tax_percentage?: number
  customPrice?: number // For custom pricing from unit selector
  originalPrice?: number // Store the original calculated price
  pricingSource?: 'default' | 'lastSold' // Track where price came from
  lastSoldDate?: string // When it was last sold (for display)
}

export interface LastSoldPrice {
  productId: string
  branchId: string
  unit: string
  price: number
  date: string
  invoiceNumber?: string
  taxMode: 'inclusive' | 'exclusive'
}

export interface AuthStatus {
  authenticated: boolean
  hasRefreshToken: boolean
  organizationId?: string
  tokenExpiresIn?: number
  tokenExpiresInHours?: number
  needsReauth?: boolean
  critical?: boolean
  status?: 'good' | 'warning' | 'critical' | 'not_authenticated'
  message?: string
  user?: {
    id: string
    name: string
    email: string
  }
}

interface POSState {
  // Auth
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
  refreshAuthStatus: () => Promise<void>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<AuthStatus>

  // Products
  products: Product[]
  setProducts: (products: Product[]) => void

  // Customers
  customers: Customer[]
  selectedCustomer: string | null
  setCustomers: (customers: Customer[]) => void
  setSelectedCustomer: (customerId: string | null) => void

  // Cart
  cart: CartItem[]
  addToCart: (product: Product, quantity?: number, unit?: string, customPrice?: number) => void
  updateCartItem: (id: string, updates: Partial<CartItem>) => void
  removeFromCart: (id: string, unit: string) => void
  clearCart: () => void

  // Settings
  taxMode: 'inclusive' | 'exclusive'
  selectedBranch: { id: string; name: string } | null
  invoiceMode: 'draft' | 'sent'
  pricingStrategy: 'default' | 'lastSoldPrice'
  printerSettings: PrinterSettings
  setTaxMode: (mode: 'inclusive' | 'exclusive') => void
  setSelectedBranch: (branch: { id: string; name: string } | null) => void
  setInvoiceMode: (mode: 'draft' | 'sent') => void
  setPricingStrategy: (strategy: 'default' | 'lastSoldPrice') => void
  setPrinterSettings: (settings: Partial<PrinterSettings>) => void

  // Last Sold Prices Cache
  lastSoldPrices: Map<string, LastSoldPrice>
  setLastSoldPrice: (key: string, price: LastSoldPrice) => void
  getLastSoldPrice: (productId: string, branchId: string, unit: string) => LastSoldPrice | null
  clearLastSoldPrices: () => void

  // UI State
  loading: boolean
  setLoading: (loading: boolean) => void
  syncStatus: string
  setSyncStatus: (status: string) => void
  priceFetchingStatus: Map<string, 'loading' | 'loaded' | 'error'>
  setPriceFetchingStatus: (productId: string, status: 'loading' | 'loaded' | 'error') => void
}

export const usePOSStore = create<POSState>()((set, get) => ({
  // Auth
  authStatus: { authenticated: false, hasRefreshToken: false },
  setAuthStatus: (status) => set({ authStatus: status }),

  // Check authentication status from API
  checkAuthStatus: async () => {
    try {
      const response = await fetch('/api/auth/status')
      const authData = await response.json()
      
      if (response.ok) {
        set({ authStatus: authData })
        return authData
      } else {
        const defaultAuth = { 
          authenticated: false, 
          hasRefreshToken: false,
          status: 'not_authenticated' as const,
          message: 'Not authenticated'
        }
        set({ authStatus: defaultAuth })
        return defaultAuth
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      const errorAuth = { 
        authenticated: false, 
        hasRefreshToken: false,
        status: 'not_authenticated' as const,
        message: 'Authentication check failed'
      }
      set({ authStatus: errorAuth })
      return errorAuth
    }
  },

  // Refresh authentication status
  refreshAuthStatus: async () => {
    const status = await get().checkAuthStatus()
    
    // Show sync status messages
    if (status.authenticated) {
      if (status.critical) {
        set({ syncStatus: '⚠️ Token expires soon - Re-authenticate immediately' })
      } else if (status.needsReauth) {
        set({ syncStatus: '⚠️ Token expires soon - Re-authenticate recommended' })
      } else {
        set({ syncStatus: `✅ Connected to Zoho Books (${status.tokenExpiresInHours?.toFixed(1)}h remaining)` })
      }
    } else {
      set({ syncStatus: '❌ Not connected to Zoho Books' })
    }
  },

  // Logout from Zoho Books
  logout: async () => {
    try {
      set({ loading: true, syncStatus: 'Logging out...' })
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      })
      
      if (response.ok) {
        set({ 
          authStatus: { 
            authenticated: false, 
            hasRefreshToken: false,
            status: 'not_authenticated',
            message: 'Logged out successfully'
          },
          syncStatus: '✅ Logged out successfully'
        })
        
        // Clear auth-dependent data
        set({ 
          products: [],
          customers: [],
          selectedCustomer: null,
          lastSoldPrices: new Map()
        })
      } else {
        set({ syncStatus: '❌ Logout failed' })
      }
    } catch (error) {
      console.error('Logout error:', error)
      set({ syncStatus: '❌ Logout failed' })
    } finally {
      set({ loading: false })
    }
  },

  // Products
  products: [],
  setProducts: (products) => set({ products }),

  // Customers
  customers: [],
  selectedCustomer: null,
  setCustomers: (customers) => set({ customers }),
  setSelectedCustomer: (customerId) => set({ selectedCustomer: customerId }),

  // Cart
  cart: [],
  addToCart: (product, quantity = 1, unit = 'PCS', customPrice) => {
    const state = get()
    const existingItem = state.cart.find(
      item => item.id === product.id && item.unit === unit && 
      (customPrice ? item.customPrice === customPrice : !item.customPrice)
    )

    if (existingItem) {
      set({
        cart: state.cart.map(item =>
          item.id === product.id && item.unit === unit && 
          (customPrice ? item.customPrice === customPrice : !item.customPrice)
            ? { ...item, qty: item.qty + quantity }
            : item
        )
      })
    } else {
      // Determine pricing strategy and calculate price
      let finalPrice = customPrice || product.price
      let pricingSource: 'default' | 'lastSold' = 'default'
      let lastSoldDate: string | undefined = undefined

      // If no custom price provided, check pricing strategy
      if (!customPrice) {
        if (state.pricingStrategy === 'lastSoldPrice' && state.selectedBranch) {
          const lastSoldPrice = state.getLastSoldPrice(product.id, state.selectedBranch.id, unit)
          if (lastSoldPrice) {
            // Adjust price for current tax mode if different from when it was sold
            finalPrice = lastSoldPrice.price
            if (lastSoldPrice.taxMode !== state.taxMode) {
              if (lastSoldPrice.taxMode === 'inclusive' && state.taxMode === 'exclusive') {
                finalPrice = finalPrice / 1.15
              } else if (lastSoldPrice.taxMode === 'exclusive' && state.taxMode === 'inclusive') {
                finalPrice = finalPrice * 1.15
              }
            }
            pricingSource = 'lastSold'
            lastSoldDate = lastSoldPrice.date
          } else {
            // Fall back to default pricing
            if (unit === 'CTN' && product.cartonPrice) {
              finalPrice = product.cartonPrice
            } else if (unit === 'PCS' && product.piecePrice) {
              finalPrice = product.piecePrice
            } else {
              finalPrice = product.price
            }
            
            // Apply tax adjustment if needed
            if (state.taxMode === 'inclusive') {
              finalPrice = finalPrice * 1.15
            }
          }
        } else {
          // Default pricing strategy
          if (unit === 'CTN' && product.cartonPrice) {
            finalPrice = product.cartonPrice
          } else if (unit === 'PCS' && product.piecePrice) {
            finalPrice = product.piecePrice
          } else {
            finalPrice = product.price
          }
          
          // Apply tax adjustment if needed
          if (state.taxMode === 'inclusive') {
            finalPrice = finalPrice * 1.15
          }
        }
      }

      const originalPrice = finalPrice

      set({
        cart: [...state.cart, {
          id: product.id,
          name: product.name,
          price: finalPrice,
          qty: quantity,
          unit,
          storedUnit: product.storedUnit || unit,
          tax_id: product.tax_id || '',
          tax_percentage: product.tax_percentage || 0,
          customPrice: customPrice,
          originalPrice: originalPrice,
          pricingSource,
          lastSoldDate,
        }]
      })

      // Save custom price to Supabase if provided and different from default
      if (customPrice && state.selectedBranch) {
        const defaultPrice = finalPrice - (customPrice || 0) + (customPrice || 0)
        // Only save if the custom price is different from what would be the calculated price
        if (Math.abs(customPrice - defaultPrice) > 0.01) {
          // Save to Supabase in the background
          fetch('/api/pos/save-last-sold-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: product.id,
              branch_id: state.selectedBranch.id,
              unit,
              price: customPrice,
              tax_mode: state.taxMode,
            }),
          }).then(async (response) => {
            if (response.ok) {
              const data = await response.json()
              if (data.success) {
                console.log(`[PRICING] Saved custom price for ${product.name}: ${customPrice} SAR`)
                // Update the in-memory cache with the new price
                const key = `${product.id}_${state.selectedBranch.id}_${unit}`
                state.setLastSoldPrice(key, {
                  productId: product.id,
                  branchId: state.selectedBranch.id,
                  unit,
                  price: customPrice,
                  date: new Date().toISOString(),
                  taxMode: state.taxMode,
                })
              }
            } else {
              console.error(`[PRICING] Failed to save custom price for ${product.name}`)
            }
          }).catch(error => {
            console.error(`[PRICING] Error saving custom price for ${product.name}:`, error)
          })
        }
      }
    }
  },

  updateCartItem: (id, updates) => {
    const state = get()
    set({
      cart: state.cart.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    })
  },

  removeFromCart: (id, unit) => {
    const state = get()
    set({
      cart: state.cart.filter(item => !(item.id === id && item.unit === unit))
    })
  },

  clearCart: () => set({ cart: [], selectedCustomer: null }),

  // Settings
  taxMode: 'exclusive',
  selectedBranch: null,
  invoiceMode: 'sent',
  pricingStrategy: 'default',
  printerSettings: getPrinterSettings(),
  setTaxMode: (mode) => set({ taxMode: mode }),
  setSelectedBranch: (branch) => {
    set({ selectedBranch: branch })
    // Clear last sold prices when branch changes
    if (branch) {
      set({ lastSoldPrices: new Map() })
    }
  },
  setInvoiceMode: (mode) => set({ invoiceMode: mode }),
  setPricingStrategy: (strategy) => {
    set({ pricingStrategy: strategy })
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos-pricing-strategy', strategy)
    }
  },
  setPrinterSettings: (settings) => {
    const current = get().printerSettings
    const updated = { ...current, ...settings }
    set({ printerSettings: updated })
    savePrinterSettings(settings)
  },

  // Last Sold Prices Cache
  lastSoldPrices: new Map(),
  setLastSoldPrice: (key, price) => {
    const state = get()
    const newMap = new Map(state.lastSoldPrices)
    newMap.set(key, price)
    set({ lastSoldPrices: newMap })
  },
  getLastSoldPrice: (productId, branchId, unit) => {
    const key = `${productId}_${branchId}_${unit}`
    return get().lastSoldPrices.get(key) || null
  },
  clearLastSoldPrices: () => set({ lastSoldPrices: new Map() }),

  // UI State
  loading: false,
  setLoading: (loading) => set({ loading }),
  syncStatus: '',
  setSyncStatus: (status) => set({ syncStatus: status }),
  priceFetchingStatus: new Map(),
  setPriceFetchingStatus: (productId, status) => {
    const state = get()
    const newMap = new Map(state.priceFetchingStatus)
    newMap.set(productId, status)
    set({ priceFetchingStatus: newMap })
  },
}))

// Initialize pricing strategy from localStorage on client side
if (typeof window !== 'undefined') {
  const savedStrategy = localStorage.getItem('pos-pricing-strategy')
  if (savedStrategy === 'lastSoldPrice' || savedStrategy === 'default') {
    usePOSStore.getState().setPricingStrategy(savedStrategy)
  }
}