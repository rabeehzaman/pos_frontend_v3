import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface ItemHistoryResponse {
  itemId: string
  itemName: string
  isGrouped: boolean
  relatedItems?: string[]
  salesTransactions: Array<{
    date: string
    type: 'SALE' | 'PURCHASE'
    quantity: number
    amount: number
    party: string
    documentNumber: string
    branch: string
    itemStatus: 'active' | 'inactive'
  }>
  purchaseTransactions: Array<{
    date: string
    type: 'SALE' | 'PURCHASE'
    quantity: number
    amount: number
    party: string
    documentNumber: string
    branch: string
    itemStatus: 'active' | 'inactive'
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log('\n========== FETCHING ITEM HISTORY ==========')
  console.log(`Item ID: ${id}`)

  try {
    // Get the last 10 transactions for this product and any items with the same clean name
    // This will include both active and inactive versions
    
    // First, get the clean name for this product
    const { data: mainProduct, error: nameError } = await supabase
      .from('item_transaction_history')
      .select('clean_item_name')
      .eq('product_id', id)
      .limit(1)
      .single()

    if (nameError || !mainProduct) {
      console.log('Product not found in history:', id)
      return NextResponse.json({
        itemId: id,
        itemName: 'Unknown Item',
        isGrouped: false,
        salesTransactions: [],
        purchaseTransactions: []
      } as ItemHistoryResponse)
    }

    // Get sales and purchase transactions separately (10 each)
    const [salesResponse, purchasesResponse] = await Promise.all([
      // Get last 10 sales transactions
      supabase
        .from('item_transaction_history')
        .select('*')
        .eq('clean_item_name', mainProduct.clean_item_name)
        .eq('transaction_type', 'SALE')
        .order('created_timestamp', { ascending: false })
        .limit(10),
      
      // Get last 10 purchase transactions  
      supabase
        .from('item_transaction_history')
        .select('*')
        .eq('clean_item_name', mainProduct.clean_item_name)
        .eq('transaction_type', 'PURCHASE')
        .order('created_timestamp', { ascending: false })
        .limit(10)
    ])

    if (salesResponse.error) {
      console.error('❌ Supabase sales error:', salesResponse.error)
      return NextResponse.json(
        { error: 'Failed to fetch sales history from database' },
        { status: 500 }
      )
    }

    if (purchasesResponse.error) {
      console.error('❌ Supabase purchases error:', purchasesResponse.error)
      return NextResponse.json(
        { error: 'Failed to fetch purchase history from database' },
        { status: 500 }
      )
    }

    const salesData = salesResponse.data || []
    const purchasesData = purchasesResponse.data || []

    if (salesData.length === 0 && purchasesData.length === 0) {
      console.log('No history found for item:', id)
      return NextResponse.json({
        itemId: id,
        itemName: 'Unknown Item',
        isGrouped: false,
        salesTransactions: [],
        purchaseTransactions: []
      } as ItemHistoryResponse)
    }

    // Get unique product IDs to check if we're showing grouped history
    const allData = [...salesData, ...purchasesData]
    const uniqueProductIds = [...new Set(allData.map(t => t.product_id))]
    const isGrouped = uniqueProductIds.length > 1

    // Get the main item name (prefer non-inactive version)
    const mainItem = allData.find(t => !t.is_inactive) || allData[0]
    const itemName = mainItem.clean_item_name || mainItem.item_name

    // Transform the sales data for frontend
    const salesTransactions = salesData.map(t => ({
      date: t.transaction_date,
      type: t.transaction_type as 'SALE' | 'PURCHASE',
      quantity: parseFloat(t.quantity || '0'),
      amount: parseFloat(t.amount || '0'),
      party: t.party_name || 'Unknown',
      documentNumber: t.document_number || '',
      branch: t.branch_id || '',
      itemStatus: t.is_inactive ? 'inactive' as const : 'active' as const
    }))

    // Transform the purchase data for frontend
    const purchaseTransactions = purchasesData.map(t => ({
      date: t.transaction_date,
      type: t.transaction_type as 'SALE' | 'PURCHASE',
      quantity: parseFloat(t.quantity || '0'),
      amount: parseFloat(t.amount || '0'),
      party: t.party_name || 'Unknown',
      documentNumber: t.document_number || '',
      branch: t.branch_id || '',
      itemStatus: t.is_inactive ? 'inactive' as const : 'active' as const
    }))

    const response: ItemHistoryResponse = {
      itemId: id,
      itemName,
      isGrouped,
      relatedItems: isGrouped ? uniqueProductIds.filter(productId => productId !== id) : undefined,
      salesTransactions,
      purchaseTransactions
    }

    console.log(`✅ Found ${salesTransactions.length} sales, ${purchaseTransactions.length} purchases${isGrouped ? ' (grouped with related items)' : ''}`)
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Failed to fetch item history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item history' },
      { status: 500 }
    )
  }
}