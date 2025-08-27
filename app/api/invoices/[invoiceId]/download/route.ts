import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params
  console.log('\n========== DOWNLOADING INVOICE (PROXY) ==========')
  console.log(`Invoice ID: ${invoiceId}`)

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://retail-pos-backend-production.up.railway.app'
    
    console.log(`[PROXY] Forwarding download to backend: ${backendUrl}/api/invoices/${invoiceId}/download`)

    // Forward the request to the backend
    const backendResponse = await fetch(`${backendUrl}/api/invoices/${invoiceId}/download`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    })

    if (!backendResponse.ok) {
      console.error('[PROXY] Backend download error:', backendResponse.status, backendResponse.statusText)
      
      // Try to get error message from backend
      let errorMessage = 'Failed to download invoice'
      try {
        const errorData = await backendResponse.json()
        errorMessage = errorData.error || errorMessage
      } catch (e) {
        // If we can't parse JSON, use default message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: backendResponse.status }
      )
    }

    // Get the PDF blob from the backend
    const pdfBlob = await backendResponse.blob()
    
    console.log(`[PROXY] Successfully received PDF blob of size: ${pdfBlob.size} bytes`)

    // Return the PDF with proper headers
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice_${invoiceId}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

  } catch (error) {
    console.error('❌ Failed to proxy invoice download request:', error)
    return NextResponse.json(
      { error: 'Failed to download invoice from backend' },
      { status: 500 }
    )
  }
}