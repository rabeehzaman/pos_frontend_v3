'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Product, Customer } from '../stores/pos-store'
import { useProducts, useCustomers } from './use-shallow-store'

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Search index interface
interface SearchIndex<T> {
  item: T
  searchText: string
  keywords: string[]
}

// Create search indexes for faster lookups
function createProductIndex(products: Product[]): SearchIndex<Product>[] {
  return products.map(product => ({
    item: product,
    searchText: [
      product.name,
      product.sku,
      product.group_name || '',
    ].join(' ').toLowerCase(),
    keywords: [
      ...product.name.toLowerCase().split(/\s+/),
      product.sku.toLowerCase(),
      ...(product.group_name?.toLowerCase().split(/\s+/) || []),
    ].filter(Boolean),
  }))
}

function createCustomerIndex(customers: Customer[]): SearchIndex<Customer>[] {
  return customers.map(customer => ({
    item: customer,
    searchText: [
      customer.contact_name,
      customer.email || '',
    ].join(' ').toLowerCase(),
    keywords: [
      ...customer.contact_name.toLowerCase().split(/\s+/),
      ...(customer.email?.toLowerCase().split(/\s+/) || []),
    ].filter(Boolean),
  }))
}

// Fast search function using indexes
function searchIndex<T>(
  index: SearchIndex<T>[],
  query: string,
  limit: number = 50
): T[] {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  const queryWords = lowerQuery.split(/\s+/).filter(Boolean)
  
  const results: Array<{ item: T; score: number }> = []

  for (const entry of index) {
    let score = 0

    // Exact matches get highest score
    if (entry.searchText.includes(lowerQuery)) {
      score += 100
    }

    // Keyword matches
    for (const queryWord of queryWords) {
      for (const keyword of entry.keywords) {
        if (keyword.includes(queryWord)) {
          score += queryWord.length / keyword.length * 10
        }
        if (keyword.startsWith(queryWord)) {
          score += 20
        }
      }
    }

    if (score > 0) {
      results.push({ item: entry.item, score })
    }

    // Early termination for performance
    if (results.length >= limit * 2) break
  }

  // Sort by score and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.item)
}

// Product search hook with debouncing and indexing
export function useDebouncedProductSearch(query: string, delay: number = 200) {
  const debouncedQuery = useDebounce(query, delay)
  const allProducts = useProducts() // Get products from Zustand store
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Create and cache search index from Zustand store products
  const productIndexData = useMemo(() => {
    return createProductIndex(allProducts)
  }, [allProducts])

  // Update search index callback (no longer needed but kept for API compatibility)
  const updateSearchIndex = useCallback(() => {
    // Index is automatically updated when allProducts changes
  }, [])

  // Perform search when query or products change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setProducts([])
      setIsLoading(false)
      return
    }

    if (productIndexData.length === 0) {
      setIsLoading(false) // Don't show loading if no products available
      setProducts([])
      return
    }

    setIsLoading(true)
    
    // Use requestIdleCallback for non-blocking search
    const searchCallback = () => {
      try {
        const results = searchIndex(productIndexData, debouncedQuery, 50)
        setProducts(results)
      } catch (error) {
        console.error('Search error:', error)
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(searchCallback)
    } else {
      setTimeout(searchCallback, 0)
    }
  }, [debouncedQuery, productIndexData])

  return {
    products,
    isLoading,
    updateIndex: updateSearchIndex,
    hasIndex: productIndexData.length > 0,
  }
}

// Customer search hook with debouncing and indexing
export function useDebouncedCustomerSearch(query: string, delay: number = 200) {
  const debouncedQuery = useDebounce(query, delay)
  const allCustomers = useCustomers() // Get customers from Zustand store
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Create and cache search index from Zustand store customers
  const customerIndexData = useMemo(() => {
    return createCustomerIndex(allCustomers)
  }, [allCustomers])

  // Update search index callback (no longer needed but kept for API compatibility)
  const updateSearchIndex = useCallback(() => {
    // Index is automatically updated when allCustomers changes
  }, [])

  // Perform search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setCustomers([])
      setIsLoading(false)
      return
    }

    if (customerIndexData.length === 0) {
      setIsLoading(false) // Don't show loading if no customers available
      setCustomers([])
      return
    }

    setIsLoading(true)

    const searchCallback = () => {
      try {
        const results = searchIndex(customerIndexData, debouncedQuery, 20)
        setCustomers(results)
      } catch (error) {
        console.error('Customer search error:', error)
        setCustomers([])
      } finally {
        setIsLoading(false)
      }
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(searchCallback)
    } else {
      setTimeout(searchCallback, 0)
    }
  }, [debouncedQuery, customerIndexData])

  return {
    customers,
    isLoading,
    updateIndex: updateSearchIndex,
    hasIndex: customerIndexData.length > 0,
  }
}

// Global search hook that searches both products and customers
export function useGlobalSearch(query: string, delay: number = 200) {
  const productSearch = useDebouncedProductSearch(query, delay)
  const customerSearch = useDebouncedCustomerSearch(query, delay)

  const isLoading = productSearch.isLoading || customerSearch.isLoading
  const hasResults = productSearch.products.length > 0 || customerSearch.customers.length > 0

  return {
    products: productSearch.products,
    customers: customerSearch.customers,
    isLoading,
    hasResults,
    updateIndexes: () => {
      productSearch.updateIndex()
      customerSearch.updateIndex()
    },
  }
}