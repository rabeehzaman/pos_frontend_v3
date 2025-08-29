'use client'

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Product, Customer } from './stores/pos-store'

// Database schema definition
interface PosDBSchema extends DBSchema {
  products: {
    key: string
    value: Product & {
      lastUpdated: number
      syncVersion: number
    }
    indexes: {
      'by-group': string
      'by-name': string
      'by-sku': string
      'by-updated': number
    }
  }
  customers: {
    key: string
    value: Customer & {
      lastUpdated: number
      syncVersion: number
    }
    indexes: {
      'by-name': string
      'by-email': string
      'by-updated': number
    }
  }
  settings: {
    key: string
    value: {
      key: string
      value: unknown
      lastUpdated: number
    }
  }
  metadata: {
    key: string
    value: {
      key: string
      lastSync: number
      version: number
      status: 'syncing' | 'synced' | 'error'
    }
  }
}

const DB_NAME = 'tmr-pos-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<PosDBSchema>> | null = null

// Initialize database
async function initDB(): Promise<IDBPDatabase<PosDBSchema>> {
  if (dbPromise) return dbPromise

  dbPromise = openDB<PosDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products store
      const productsStore = db.createObjectStore('products', {
        keyPath: 'id',
      })
      productsStore.createIndex('by-group', 'group_name')
      productsStore.createIndex('by-name', 'name')
      productsStore.createIndex('by-sku', 'sku')
      productsStore.createIndex('by-updated', 'lastUpdated')

      // Customers store
      const customersStore = db.createObjectStore('customers', {
        keyPath: 'contact_id',
      })
      customersStore.createIndex('by-name', 'contact_name')
      customersStore.createIndex('by-email', 'email')
      customersStore.createIndex('by-updated', 'lastUpdated')

      // Settings store
      db.createObjectStore('settings', {
        keyPath: 'key',
      })

      // Metadata store for sync status
      db.createObjectStore('metadata', {
        keyPath: 'key',
      })
    },
  })

  return dbPromise
}

// Products cache operations
export const productsCache = {
  async getAll(): Promise<Product[]> {
    const db = await initDB()
    const products = await db.getAll('products')
    return products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      sku: p.sku,
      group_name: p.group_name,
      tax_id: p.tax_id,
      tax_percentage: p.tax_percentage,
      storedUnit: p.storedUnit,
      piecePrice: p.piecePrice,
      cartonPrice: p.cartonPrice,
      piecesPerCarton: p.piecesPerCarton,
      hasConversion: p.hasConversion,
      defaultUnit: p.defaultUnit,
    }))
  },

  async set(products: Product[]): Promise<void> {
    const db = await initDB()
    const tx = db.transaction('products', 'readwrite')
    const now = Date.now()
    const syncVersion = now

    await Promise.all([
      ...products.map(product => 
        tx.store.put({
          ...product,
          lastUpdated: now,
          syncVersion,
        })
      ),
      tx.done,
    ])

    // Update metadata
    await this.setMetadata('products', {
      lastSync: now,
      version: syncVersion,
      status: 'synced',
    })
  },

  async getBySearch(query: string, limit = 50): Promise<Product[]> {
    if (!query.trim()) return this.getAll()

    const db = await initDB()
    const products = await db.getAll('products')
    const lowerQuery = query.toLowerCase()

    return products
      .filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        (p.group_name?.toLowerCase().includes(lowerQuery))
      )
      .slice(0, limit)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        sku: p.sku,
        group_name: p.group_name,
        tax_id: p.tax_id,
        tax_percentage: p.tax_percentage,
        storedUnit: p.storedUnit,
        piecePrice: p.piecePrice,
        cartonPrice: p.cartonPrice,
        piecesPerCarton: p.piecesPerCarton,
        hasConversion: p.hasConversion,
        defaultUnit: p.defaultUnit,
      }))
  },

  async getByCategory(category: string): Promise<Product[]> {
    if (category === 'All') return this.getAll()

    const db = await initDB()
    const products = await db.getAllFromIndex('products', 'by-group', category)
    return products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      sku: p.sku,
      group_name: p.group_name,
      tax_id: p.tax_id,
      tax_percentage: p.tax_percentage,
      storedUnit: p.storedUnit,
      piecePrice: p.piecePrice,
      cartonPrice: p.cartonPrice,
      piecesPerCarton: p.piecesPerCarton,
      hasConversion: p.hasConversion,
      defaultUnit: p.defaultUnit,
    }))
  },

  async setMetadata(key: string, metadata: Record<string, unknown>): Promise<void> {
    const db = await initDB()
    await db.put('metadata', {
      key,
      lastSync: Date.now(),
      version: 1,
      status: 'synced' as const,
      ...metadata,
    })
  },

  async getMetadata(key: string): Promise<Record<string, unknown> | undefined> {
    const db = await initDB()
    return db.get('metadata', key)
  },

  async clear(): Promise<void> {
    const db = await initDB()
    await db.clear('products')
  },
}

// Customers cache operations
export const customersCache = {
  async getAll(): Promise<Customer[]> {
    const db = await initDB()
    const customers = await db.getAll('customers')
    return customers.map(c => ({
      contact_id: c.contact_id,
      contact_name: c.contact_name,
      contact_persons: c.contact_persons,
      email: c.email,
    }))
  },

  async set(customers: Customer[]): Promise<void> {
    const db = await initDB()
    const tx = db.transaction('customers', 'readwrite')
    const now = Date.now()
    const syncVersion = now

    await Promise.all([
      ...customers.map(customer => 
        tx.store.put({
          ...customer,
          lastUpdated: now,
          syncVersion,
        })
      ),
      tx.done,
    ])

    // Update metadata
    await this.setMetadata('customers', {
      lastSync: now,
      version: syncVersion,
      status: 'synced',
    })
  },

  async getBySearch(query: string, limit = 20): Promise<Customer[]> {
    if (!query.trim()) return this.getAll()

    const db = await initDB()
    const customers = await db.getAll('customers')
    const lowerQuery = query.toLowerCase()

    return customers
      .filter(c => 
        c.contact_name.toLowerCase().includes(lowerQuery) ||
        (c.email?.toLowerCase().includes(lowerQuery))
      )
      .slice(0, limit)
      .map(c => ({
        contact_id: c.contact_id,
        contact_name: c.contact_name,
        contact_persons: c.contact_persons,
        email: c.email,
      }))
  },

  async setMetadata(key: string, metadata: Record<string, unknown>): Promise<void> {
    const db = await initDB()
    await db.put('metadata', {
      key,
      lastSync: Date.now(),
      version: 1,
      status: 'synced' as const,
      ...metadata,
    })
  },

  async getMetadata(key: string): Promise<Record<string, unknown> | undefined> {
    const db = await initDB()
    return db.get('metadata', key)
  },

  async clear(): Promise<void> {
    const db = await initDB()
    await db.clear('customers')
  },
}

// Settings cache operations
export const settingsCache = {
  async get(key: string): Promise<unknown> {
    const db = await initDB()
    const setting = await db.get('settings', key)
    return setting?.value
  },

  async set(key: string, value: unknown): Promise<void> {
    const db = await initDB()
    await db.put('settings', {
      key,
      value,
      lastUpdated: Date.now(),
    })
  },

  async delete(key: string): Promise<void> {
    const db = await initDB()
    await db.delete('settings', key)
  },

  async clear(): Promise<void> {
    const db = await initDB()
    await db.clear('settings')
  },
}

// Cache management utilities
export const cacheManager = {
  async isStale(cacheType: 'products' | 'customers', maxAge = 5 * 60 * 1000): Promise<boolean> {
    const cache = cacheType === 'products' ? productsCache : customersCache
    const metadata = await cache.getMetadata(cacheType)
    
    if (!metadata?.lastSync) return true
    
    return Date.now() - Number(metadata.lastSync) > maxAge
  },

  async getSyncStatus(cacheType: 'products' | 'customers'): Promise<{
    lastSync: number | null
    status: 'syncing' | 'synced' | 'error' | 'never'
    isStale: boolean
  }> {
    const cache = cacheType === 'products' ? productsCache : customersCache
    const metadata = await cache.getMetadata(cacheType)
    
    if (!metadata) {
      return {
        lastSync: null,
        status: 'never',
        isStale: true,
      }
    }

    return {
      lastSync: Number(metadata.lastSync) || null,
      status: metadata.status as 'syncing' | 'synced' | 'error',
      isStale: await this.isStale(cacheType),
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      productsCache.clear(),
      customersCache.clear(),
      settingsCache.clear(),
    ])
  },
}