'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Clock, DollarSign } from 'lucide-react'
import { Product } from '@/lib/stores/pos-store'
import { useDebouncedProductSearch } from '@/lib/hooks/use-debounced-search'
import { useSettings } from '@/lib/hooks/use-shallow-store'
import { usePOSStore } from '@/lib/stores/pos-store'

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product, quantity?: number, unit?: string, customPrice?: number) => void
  searchQuery?: string
  isLoading?: boolean
}

export const ProductGrid = React.memo<ProductGridProps>(function ProductGrid({ 
  products, 
  onAddToCart, 
  searchQuery = '', 
  isLoading = false 
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const { taxMode } = useSettings()
  
  // Get store state for pricing strategy
  const { 
    pricingStrategy, 
    selectedBranch,
    lastSoldPrices,
    setLastSoldPrice,
    priceFetchingStatus,
    setPriceFetchingStatus
  } = usePOSStore()

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.group_name).filter(Boolean) as string[])
    return ['All', ...Array.from(cats).sort()]
  }, [products])

  // Use debounced search for better performance
  const { 
    products: searchResults, 
    isLoading: isSearching, 
    hasIndex: hasSearchIndex 
  } = useDebouncedProductSearch(searchQuery, 150)

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let baseProducts = products
    
    // If we have a search query and search results, use them
    if (searchQuery.trim() && searchResults.length > 0 && hasSearchIndex) {
      baseProducts = searchResults
    } else if (searchQuery.trim() && hasSearchIndex && searchResults.length === 0) {
      // Empty search results means no matches found
      return []
    } else if (searchQuery.trim() && !hasSearchIndex) {
      // Fallback to basic filtering if search index isn't ready
      baseProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply category filter
    if (selectedCategory === 'All') {
      return baseProducts
    }
    
    return baseProducts.filter(product => product.group_name === selectedCategory)
  }, [products, searchResults, searchQuery, selectedCategory, hasSearchIndex])

  // Fetch last sold prices from Supabase when pricing strategy changes or branch changes
  const fetchLastSoldPrices = useCallback(async () => {
    if (pricingStrategy !== 'lastSoldPrice' || !selectedBranch || filteredProducts.length === 0) {
      return
    }

    try {
      console.log(`[PRICING] Fetching Supabase prices for branch ${selectedBranch.id}`)
      
      // Mark visible products as loading
      const visibleProductIds = filteredProducts.slice(0, 60).map(p => p.id)
      visibleProductIds.forEach(productId => setPriceFetchingStatus(productId, 'loading'))

      // Fetch from Supabase API
      const res = await fetch('/api/pos/last-sold-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_ids: visibleProductIds, 
          branch_id: selectedBranch.id 
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      
      if (data.success && data.prices) {
        // Load prices into store
        data.prices.forEach((priceData: { product_id: string; branch_id: string; unit: string; price: number; created_at: string; tax_mode: string }) => {
          const key = `${priceData.product_id}_${priceData.branch_id}_${priceData.unit}`
          const lastSoldPrice = {
            productId: priceData.product_id,
            branchId: priceData.branch_id,
            unit: priceData.unit,
            price: priceData.price,
            date: priceData.created_at,
            taxMode: priceData.tax_mode as 'inclusive' | 'exclusive',
          }
          setLastSoldPrice(key, lastSoldPrice)
          setPriceFetchingStatus(priceData.product_id, 'loaded')
        })

        // Set error status for products that don't have saved prices
        const foundProductIds = data.prices.map((p: { product_id: string }) => p.product_id)
        visibleProductIds.forEach(id => {
          if (!foundProductIds.includes(id)) {
            setPriceFetchingStatus(id, 'error')
          }
        })

        console.log(`[PRICING] Loaded ${data.prices.length} prices from Supabase`)
      }
    } catch (error) {
      console.error('[PRICING] Error fetching last sold prices from Supabase:', error)
      const ids = filteredProducts.slice(0, 60).map(p => p.id)
      ids.forEach(productId => setPriceFetchingStatus(productId, 'error'))
    }
  }, [pricingStrategy, selectedBranch, filteredProducts, setLastSoldPrice, setPriceFetchingStatus])

  // Trigger price fetching when conditions change
  useEffect(() => {
    fetchLastSoldPrices()
  }, [fetchLastSoldPrices])

  // Calculate displayed price for a product
  const getDisplayPrice = useCallback((product: Product) => {
    if (pricingStrategy === 'lastSoldPrice' && selectedBranch) {
      const key = `${product.id}_${selectedBranch.id}_PCS`
      const lastSoldPrice = lastSoldPrices.get(key)
      
      if (lastSoldPrice) {
        // Adjust price for current tax mode if different from when it was sold
        let adjustedPrice = lastSoldPrice.price
        if (lastSoldPrice.taxMode !== taxMode) {
          if (lastSoldPrice.taxMode === 'inclusive' && taxMode === 'exclusive') {
            adjustedPrice = adjustedPrice / 1.15
          } else if (lastSoldPrice.taxMode === 'exclusive' && taxMode === 'inclusive') {
            adjustedPrice = adjustedPrice * 1.15
          }
        }
        return {
          price: adjustedPrice,
          source: 'lastSold' as const,
          date: lastSoldPrice.date,
          isLoading: false
        }
      }
      
      // Check if we're currently loading this price
      const fetchStatus = priceFetchingStatus.get(product.id)
      if (fetchStatus === 'loading') {
        return {
          price: product.price,
          source: 'default' as const,
          date: null,
          isLoading: true
        }
      }
    }
    
    // Default pricing
    let price = product.price
    if (taxMode === 'inclusive') {
      price = price * 1.15
    }
    
    return {
      price,
      source: 'default' as const,
      date: null,
      isLoading: false
    }
  }, [pricingStrategy, selectedBranch, lastSoldPrices, taxMode, priceFetchingStatus])

  // Calculate grid dimensions based on container width
  const gridConfig = useMemo(() => {
    const containerWidth = containerDimensions.width
    if (containerWidth === 0) return { columnCount: 2, columnWidth: 200, itemHeight: 200 }
    
    // Responsive breakpoints matching Tailwind CSS
    let columnCount = 2 // Default for mobile
    if (containerWidth >= 1536) columnCount = 8 // 2xl
    else if (containerWidth >= 1280) columnCount = 6 // xl
    else if (containerWidth >= 1024) columnCount = 5 // lg
    else if (containerWidth >= 768) columnCount = 4 // md
    else if (containerWidth >= 640) columnCount = 3 // sm
    
    const gap = 24 // 6 * 4 (gap-6 in Tailwind)
    const padding = 48 // 12 * 4 (px-6 py-8)
    const availableWidth = containerWidth - padding - (gap * (columnCount - 1))
    const columnWidth = Math.floor(availableWidth / columnCount)
    
    return {
      columnCount,
      columnWidth: Math.max(columnWidth, 150), // Minimum width
      itemHeight: 200, // Increased height to accommodate pricing info
    }
  }, [containerDimensions.width])

  // Calculate row count
  const rowCount = Math.ceil(filteredProducts.length / gridConfig.columnCount)

  // Product Card Component
  const ProductCard = useCallback(({ product }: { product: Product }) => {
    const priceInfo = getDisplayPrice(product)
    
    return (
      <Card 
        className="h-full cursor-pointer hover:shadow-md transition-all duration-200 border border-border/50"
        onClick={() => onAddToCart(product)}
      >
        <CardContent className="p-4 h-full flex flex-col">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate" title={product.name}>
                  {product.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate mt-1" title={product.sku}>
                  {product.sku}
                </p>
              </div>
              {product.group_name && (
                <Badge variant="secondary" className="ml-2 text-xs shrink-0">
                  {product.group_name}
                </Badge>
              )}
            </div>
            
            {/* Price Display */}
            <div className="mt-auto pt-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  {priceInfo.isLoading ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 animate-spin" />
                      Loading price...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-lg">
                          {priceInfo.price.toFixed(2)} SAR
                        </span>
                        {priceInfo.source === 'lastSold' && (
                          <DollarSign className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                      {priceInfo.source === 'lastSold' && priceInfo.date && (
                        <span className="text-xs text-green-600">
                          Last sold: {new Date(priceInfo.date).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    Stock: {(product as Product & { stock_on_hand?: number }).stock_on_hand || 0}
                  </div>
                  {product.defaultUnit && (
                    <div className="text-xs text-muted-foreground">
                      Unit: {product.defaultUnit}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }, [getDisplayPrice, onAddToCart])

  // Grid Cell Component
  const Cell = useCallback(({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
    const productIndex = rowIndex * gridConfig.columnCount + columnIndex
    const product = filteredProducts[productIndex]

    if (!product) {
      return <div style={style} />
    }

    return (
      <div style={{ ...style, padding: '12px' }}>
        <ProductCard product={product} />
      </div>
    )
  }, [filteredProducts, gridConfig.columnCount, ProductCard])

  // Update container dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setContainerDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="border-b border-border/30 bg-background/50 backdrop-blur-sm">
        <div className="container px-4 py-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="h-full px-6 py-8">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
              {Array.from({ length: 12 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <Package className="h-16 w-16 text-muted-foreground/40 mb-6" />
              <h3 className="text-xl font-medium mb-3 tracking-tight">No products found</h3>
              <p className="text-muted-foreground/80 mb-6 max-w-sm">
                {searchQuery 
                  ? `No products match "${searchQuery}". Try a different search term.`
                  : 'No products available in this category.'
                }
              </p>
            </div>
          ) : containerDimensions.width > 0 ? (
            <Grid
              columnCount={gridConfig.columnCount}
              columnWidth={gridConfig.columnWidth}
              height={containerDimensions.height - 64} // Account for padding
              rowCount={rowCount}
              rowHeight={gridConfig.itemHeight}
              width={containerDimensions.width}
            >
              {Cell}
            </Grid>
          ) : null}
        </div>
      </div>
    </div>
  )
})

const ProductCardSkeleton = () => (
  <Card className="h-[180px]">
    <CardContent className="p-4 h-full">
      <div className="space-y-3">
        <div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-3 w-1/3" />
        <div className="mt-auto pt-4">
          <Skeleton className="h-6 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
)