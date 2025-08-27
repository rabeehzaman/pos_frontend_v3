'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { productsCache, customersCache, cacheManager } from '../database'
import { Product, Customer } from '../stores/pos-store'
import { toast } from 'sonner'

interface CacheConfig {
  staleTime?: number
  maxAge?: number
  enableBackgroundSync?: boolean
  retryOnError?: boolean
}

const defaultConfig: CacheConfig = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  maxAge: 5 * 60 * 1000, // 5 minutes
  enableBackgroundSync: true,
  retryOnError: true,
}

// Custom hook for cached products
export function useCachedProducts(config: CacheConfig = {}) {
  const { staleTime, maxAge, enableBackgroundSync, retryOnError } = { ...defaultConfig, ...config }
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')

  // Primary query that tries cache first, then API
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', 'cached'],
    queryFn: async (): Promise<Product[]> => {
      try {
        // Check if we have cached data and if it's fresh enough
        const cachedProducts = await productsCache.getAll()
        const isStale = await cacheManager.isStale('products', maxAge)

        // If we have cached data and it's not stale, use it
        if (cachedProducts.length > 0 && !isStale) {
          // Still sync in background if enabled
          if (enableBackgroundSync) {
            backgroundSyncProducts()
          }
          return cachedProducts
        }

        // If no cached data or stale, fetch from API
        setSyncStatus('syncing')
        const response = await axios.get('/api/items?limit=200')
        const apiProducts = response.data.items || []

        // Cache the fresh data
        await productsCache.set(apiProducts)
        setSyncStatus('idle')
        
        return apiProducts
      } catch (apiError) {
        setSyncStatus('error')
        
        // If API fails, try to return cached data as fallback
        const cachedProducts = await productsCache.getAll()
        if (cachedProducts.length > 0) {
          toast.warning('Using offline data - some items may be outdated')
          return cachedProducts
        }

        // If no cached data and API fails, throw error
        throw apiError
      }
    },
    staleTime,
    retry: retryOnError ? 2 : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  // Background sync function
  const backgroundSyncProducts = useCallback(async () => {
    try {
      setSyncStatus('syncing')
      const response = await axios.get('/api/items?limit=200')
      const apiProducts = response.data.items || []
      
      await productsCache.set(apiProducts)
      
      // Update the query cache
      queryClient.setQueryData(['products', 'cached'], apiProducts)
      setSyncStatus('idle')
    } catch (error) {
      setSyncStatus('error')
      console.error('Background sync failed:', error)
    }
  }, [queryClient])

  // Periodic background sync
  useEffect(() => {
    if (!enableBackgroundSync) return

    const interval = setInterval(async () => {
      const isStale = await cacheManager.isStale('products', maxAge)
      if (isStale) {
        backgroundSyncProducts()
      }
    }, 60 * 1000) // Check every minute

    return () => clearInterval(interval)
  }, [enableBackgroundSync, maxAge])

  return {
    products,
    isLoading,
    error,
    syncStatus,
    refreshData: () => queryClient.invalidateQueries({ queryKey: ['products', 'cached'] }),
    forceSync: backgroundSyncProducts,
  }
}

// Custom hook for cached customers
export function useCachedCustomers(config: CacheConfig = {}) {
  const { staleTime, maxAge, enableBackgroundSync, retryOnError } = { ...defaultConfig, ...config }
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers', 'cached'],
    queryFn: async (): Promise<Customer[]> => {
      try {
        // Check cached data
        const cachedCustomers = await customersCache.getAll()
        const isStale = await cacheManager.isStale('customers', maxAge)

        if (cachedCustomers.length > 0 && !isStale) {
          if (enableBackgroundSync) {
            backgroundSyncCustomers()
          }
          return cachedCustomers
        }

        // Fetch from API
        setSyncStatus('syncing')
        const response = await axios.get('/api/customers?limit=100')
        const apiCustomers = response.data.customers || []

        await customersCache.set(apiCustomers)
        setSyncStatus('idle')
        
        return apiCustomers
      } catch (apiError) {
        setSyncStatus('error')
        
        // Fallback to cached data
        const cachedCustomers = await customersCache.getAll()
        if (cachedCustomers.length > 0) {
          toast.warning('Using offline customer data')
          return cachedCustomers
        }

        throw apiError
      }
    },
    staleTime,
    retry: retryOnError ? 2 : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  const backgroundSyncCustomers = useCallback(async () => {
    try {
      setSyncStatus('syncing')
      const response = await axios.get('/api/customers?limit=100')
      const apiCustomers = response.data.customers || []
      
      await customersCache.set(apiCustomers)
      queryClient.setQueryData(['customers', 'cached'], apiCustomers)
      setSyncStatus('idle')
    } catch (error) {
      setSyncStatus('error')
      console.error('Customer background sync failed:', error)
    }
  }, [queryClient])

  // Periodic sync
  useEffect(() => {
    if (!enableBackgroundSync) return

    const interval = setInterval(async () => {
      const isStale = await cacheManager.isStale('customers', maxAge)
      if (isStale) {
        backgroundSyncCustomers()
      }
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [enableBackgroundSync, maxAge])

  return {
    customers,
    isLoading,
    error,
    syncStatus,
    refreshData: () => queryClient.invalidateQueries({ queryKey: ['customers', 'cached'] }),
    forceSync: backgroundSyncCustomers,
  }
}

// Cached search hooks
export function useCachedProductSearch(query: string, limit = 50) {
  return useQuery({
    queryKey: ['products', 'search', query, limit],
    queryFn: () => productsCache.getBySearch(query, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes for search results
    enabled: query.length > 0,
  })
}

export function useCachedCustomerSearch(query: string, limit = 20) {
  return useQuery({
    queryKey: ['customers', 'search', query, limit],
    queryFn: () => customersCache.getBySearch(query, limit),
    staleTime: 10 * 60 * 1000,
    enabled: query.length > 0,
  })
}

// Cache status hook
export function useCacheStatus() {
  const [status, setStatus] = useState<{
    products: Awaited<ReturnType<typeof cacheManager.getSyncStatus>>
    customers: Awaited<ReturnType<typeof cacheManager.getSyncStatus>>
  } | null>(null)

  useEffect(() => {
    const updateStatus = async () => {
      const [productsStatus, customersStatus] = await Promise.all([
        cacheManager.getSyncStatus('products'),
        cacheManager.getSyncStatus('customers'),
      ])
      
      setStatus({
        products: productsStatus,
        customers: customersStatus,
      })
    }

    updateStatus()
    
    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  return {
    status,
    clearCache: cacheManager.clearAll,
  }
}