import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product_id, branch_id, unit, price, tax_mode } = body

    if (!product_id || !branch_id || !unit || !price || !tax_mode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate tax_mode
    if (!['inclusive', 'exclusive'].includes(tax_mode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tax_mode. Must be inclusive or exclusive' },
        { status: 400 }
      )
    }

    // Upsert the price (insert or update if exists)
    const { data, error } = await supabase
      .from('pos_last_sold_prices')
      .upsert({
        product_id,
        branch_id,
        unit,
        price: parseFloat(price),
        tax_mode,
        updated_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data?.[0] || null
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}