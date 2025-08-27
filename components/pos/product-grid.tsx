'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, AlertTriangle } from 'lucide-react'
import { Product } from '@/lib/stores/pos-store'
import { UnitSelectorDialog } from './unit-selector-dialog'
import { useDebouncedProductSearch } from '@/lib/hooks/use-debounced-search'
import { useSettings } from '@/lib/hooks/use-shallow-store'

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
      itemHeight: 180, // Optimized height for compact layout
    }
  }, [containerDimensions.width])

  // Calculate row count
  const rowCount = Math.ceil(filteredProducts.length / gridConfig.columnCount)

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
                  ? `No products match "${searchQuery}"` 
                  : 'No products available in this category'
                }
              </p>
              <div className="text-sm text-muted-foreground/60">
                Press <kbd className="px-2 py-1 bg-muted/50 rounded-md text-xs font-mono">Ctrl+Space</kbd> to search
              </div>
            </div>
          ) : (isSearching && searchQuery.trim()) ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
                <span>Searching...</span>
              </div>
            </div>
          ) : containerDimensions.width > 0 ? (
            <Grid
              columnCount={gridConfig.columnCount}
              columnWidth={gridConfig.columnWidth}
              height={containerDimensions.height - 64} // Subtract padding
              width={containerDimensions.width}
              rowCount={rowCount}
              rowHeight={gridConfig.itemHeight}
              itemData={{
                products: filteredProducts,
                columnCount: gridConfig.columnCount,
                taxMode,
                onAddToCart,
              }}
            >
              {VirtualizedProductCard}
            </Grid>
          ) : null}
        </div>
      </div>
    </div>
  )
})

interface ProductCardProps {
  product: Product
  taxMode: 'inclusive' | 'exclusive'
  onAddToCart: (product: Product, quantity?: number, unit?: string, customPrice?: number) => void
}

const ProductCard = React.memo(function ProductCard({ product, taxMode, onAddToCart }: ProductCardProps) {
  const [showUnitDialog, setShowUnitDialog] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  
  const isLowStock = product.stock < 10
  const isOutOfStock = product.stock === 0
  
  // Check if product has unit conversion capabilities
  const hasUnitConversion = product.hasConversion && product.piecesPerCarton && product.piecesPerCarton > 1

  // Calculate display price based on tax mode
  const displayPrice = taxMode === 'inclusive' ? product.price * 1.15 : product.price

  // Click handlers
  const handleMouseDown = () => {
    if (isOutOfStock) return
    setIsPressed(true)
  }

  const handleMouseUp = () => {
    setIsPressed(false)
    
    // Single click always opens the unit selector dialog
    if (!isOutOfStock) {
      setShowUnitDialog(true)
    }
  }

  const handleMouseLeave = () => {
    setIsPressed(false)
  }

  const handleDialogAddToCart = (prod: Product, quantity: number, unit: string, customPrice?: number) => {
    onAddToCart(prod, quantity, unit, customPrice)
  }

  return (
    <>
      <Card 
        className={`group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:scale-[1.02] border-border/40 select-none h-full ${
          isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''
        } ${
          isPressed ? 'scale-[0.95] shadow-inner' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
      <CardContent className="p-3 flex flex-col h-full">
        {/* Product Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-tight line-clamp-3 mb-1" title={product.name}>
              {product.name}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge 
              variant={isOutOfStock ? 'destructive' : isLowStock ? 'secondary' : 'outline'}
              className="text-xs px-2 py-0.5 rounded-full font-medium border-0"
            >
              {product.stock}
            </Badge>
            {isLowStock && !isOutOfStock && (
              <AlertTriangle className="h-3 w-3 text-yellow-500/80" />
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Price - Fixed at bottom */}
        <div className="text-center py-0.5 mt-auto">
          <div className="text-lg font-semibold tracking-tight">
            {displayPrice.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground/60">
            per unit {taxMode === 'inclusive' ? '(inc. tax)' : ''}
          </div>
          {/* Status indicator */}
          {isOutOfStock && (
            <div className="text-xs text-muted-foreground/80 font-medium mt-1">
              Out of Stock
            </div>
          )}
        </div>
      </CardContent>
      </Card>
      
      {/* Unit Selector Dialog */}
      <UnitSelectorDialog
        product={product}
        open={showUnitDialog}
        onClose={() => setShowUnitDialog(false)}
        onAddToCart={handleDialogAddToCart}
        taxMode={taxMode}
      />
    </>
  )
})

// Virtualized product card component
interface VirtualizedProductCardProps {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: {
    products: Product[]
    columnCount: number
    taxMode: 'inclusive' | 'exclusive'
    onAddToCart: (product: Product, quantity?: number, unit?: string, customPrice?: number) => void
  }
}

const VirtualizedProductCard = React.memo<VirtualizedProductCardProps>(function VirtualizedProductCard({ 
  columnIndex, 
  rowIndex, 
  style, 
  data 
}) {
  const { products, columnCount, taxMode, onAddToCart } = data
  const productIndex = rowIndex * columnCount + columnIndex
  const product = products[productIndex]

  if (!product) {
    return <div style={style} />
  }

  return (
    <div style={style} className="p-3">
      <ProductCard
        product={product}
        taxMode={taxMode}
        onAddToCart={onAddToCart}
      />
    </div>
  )
})

const ProductCardSkeleton = React.memo(function ProductCardSkeleton() {
  return (
    <Card className="group border-border/40">
      <CardContent className="p-3">
        {/* Product Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-4/5 mb-1" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-10 rounded-full flex-shrink-0" />
        </div>

        {/* Price */}
        <div className="text-center mt-6">
          <Skeleton className="h-6 w-16 mx-auto mb-1" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      </CardContent>
    </Card>
  )
})