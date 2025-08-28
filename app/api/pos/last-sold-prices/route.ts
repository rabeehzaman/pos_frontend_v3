import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product_ids, branch_id } = body

    if (!product_ids || !Array.isArray(product_ids) || !branch_id) {
      return NextResponse.json(
        { success: false, error: 'Missing product_ids or branch_id' },
        { status: 400 }
      )
    }

    // Fetch last sold prices for the specified products and branch
    const { data, error } = await supabase
      .from('pos_last_sold_prices')
      .select('product_id, branch_id, unit, price, tax_mode, created_at')
      .in('product_id', product_ids)
      .eq('branch_id', branch_id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      prices: data || []
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}