import { toast } from 'sonner'
import { printPDFBlob, getPrinterSettings, shouldAutoPrintInvoice } from './printer'

export interface DownloadInvoiceOptions {
  invoiceId: string
  invoiceNumber: string
  isDraft?: boolean
}

export interface DownloadAndPrintOptions extends DownloadInvoiceOptions {
  autoPrint?: boolean
  skipDownload?: boolean
}

/**
 * Downloads an invoice PDF from the backend
 * @param options - Invoice download options
 * @returns Promise<boolean> - Success status
 */
export async function downloadInvoice({
  invoiceId,
  invoiceNumber,
  isDraft = false
}: DownloadInvoiceOptions): Promise<boolean> {
  const toastId = toast.loading(`Downloading ${isDraft ? 'draft ' : ''}invoice ${invoiceNumber}...`)
  
  try {
    console.log('Downloading invoice:', invoiceId)
    
    const response = await fetch(`/api/invoices/${invoiceId}/download`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    })
    
    if (!response.ok) {
      let errorMessage = 'Failed to download invoice'
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (e) {
        // If we can't parse JSON, use status-based messages
        if (response.status === 404) {
          errorMessage = 'Invoice PDF not found. It may still be generating.'
        } else if (response.status === 401) {
          errorMessage = 'Authentication error. Please refresh and try again.'
        }
      }
      
      toast.error(errorMessage, { id: toastId })
      return false
    }
    
    // Get the PDF blob
    const pdfBlob = await response.blob()
    
    // Check if response is actually a PDF
    if (pdfBlob.type && !pdfBlob.type.includes('pdf')) {
      throw new Error('Response is not a PDF file')
    }
    
    // Create download link and trigger download
    const url = window.URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    
    // Set filename based on invoice type
    const filename = isDraft 
      ? `Draft_Invoice_${invoiceNumber}.pdf`
      : `Invoice_${invoiceNumber}.pdf`
    
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    link.remove()
    window.URL.revokeObjectURL(url)
    
    console.log(`Invoice ${invoiceNumber} downloaded successfully`)
    toast.success(`${isDraft ? 'Draft invoice' : 'Invoice'} ${invoiceNumber} downloaded!`, { id: toastId })
    
    return true
    
  } catch (error) {
    console.error('Failed to download invoice:', error)
    
    let errorMessage = 'Failed to download invoice PDF. Please try again.'
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Failed to download invoice. Please check your connection.'
      } else if (error.message.includes('PDF')) {
        errorMessage = 'Invalid PDF response. Please try again.'
      }
    }
    
    toast.error(errorMessage, { id: toastId })
    return false
  }
}

/**
 * Downloads an invoice with a delay (useful after invoice creation)
 * @param options - Invoice download options
 * @param delay - Delay in milliseconds (default: 2000ms)
 * @returns Promise<boolean> - Success status
 */
export async function downloadInvoiceWithDelay(
  options: DownloadInvoiceOptions,
  delay: number = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const success = await downloadInvoice(options)
      resolve(success)
    }, delay)
  })
}

/**
 * Downloads and optionally prints an invoice PDF
 * @param options - Invoice download and print options
 * @returns Promise<boolean> - Success status
 */
export async function downloadAndPrintInvoice({
  invoiceId,
  invoiceNumber,
  isDraft = false,
  autoPrint = false,
  skipDownload = false
}: DownloadAndPrintOptions): Promise<boolean> {
  const toastId = toast.loading(
    skipDownload 
      ? `Preparing to print ${isDraft ? 'draft ' : ''}invoice ${invoiceNumber}...`
      : `Downloading ${isDraft ? 'draft ' : ''}invoice ${invoiceNumber}...`
  )
  
  try {
    console.log('Downloading and printing invoice:', invoiceId)
    
    const response = await fetch(`/api/invoices/${invoiceId}/download`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    })
    
    if (!response.ok) {
      let errorMessage = 'Failed to download invoice'
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (e) {
        if (response.status === 404) {
          errorMessage = 'Invoice PDF not found. It may still be generating.'
        } else if (response.status === 401) {
          errorMessage = 'Authentication error. Please refresh and try again.'
        }
      }
      
      toast.error(errorMessage, { id: toastId })
      return false
    }
    
    // Get the PDF blob
    const pdfBlob = await response.blob()
    
    // Check if response is actually a PDF
    if (pdfBlob.type && !pdfBlob.type.includes('pdf')) {
      throw new Error('Response is not a PDF file')
    }
    
    const downloadSuccess = true
    let printSuccess = true
    
    // Download the file if not skipping
    if (!skipDownload) {
      const url = window.URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      
      const filename = isDraft 
        ? `Draft_Invoice_${invoiceNumber}.pdf`
        : `Invoice_${invoiceNumber}.pdf`
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      console.log(`Invoice ${invoiceNumber} downloaded successfully`)
    }
    
    // Print if auto-print is enabled
    if (autoPrint || shouldAutoPrintInvoice()) {
      toast.loading(`Printing ${isDraft ? 'draft ' : ''}invoice ${invoiceNumber}...`, { id: toastId })
      
      const settings = getPrinterSettings()
      printSuccess = await printPDFBlob(pdfBlob, {
        documentTitle: `${isDraft ? 'Draft ' : ''}Invoice ${invoiceNumber}`,
        copies: settings.numberOfCopies,
        silent: settings.silentPrint
      })
      
      if (printSuccess) {
        toast.success(
          skipDownload 
            ? `${isDraft ? 'Draft invoice' : 'Invoice'} ${invoiceNumber} sent to printer!`
            : `${isDraft ? 'Draft invoice' : 'Invoice'} ${invoiceNumber} downloaded and printed!`, 
          { id: toastId }
        )
      } else {
        toast.success(
          skipDownload 
            ? `Print failed for ${isDraft ? 'draft ' : ''}invoice ${invoiceNumber}`
            : `${isDraft ? 'Draft invoice' : 'Invoice'} ${invoiceNumber} downloaded but print failed`, 
          { id: toastId }
        )
      }
    } else if (!skipDownload) {
      toast.success(`${isDraft ? 'Draft invoice' : 'Invoice'} ${invoiceNumber} downloaded!`, { id: toastId })
    }
    
    return downloadSuccess && printSuccess
    
  } catch (error) {
    console.error('Failed to download/print invoice:', error)
    
    let errorMessage = 'Failed to download invoice PDF. Please try again.'
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Failed to download invoice. Please check your connection.'
      } else if (error.message.includes('PDF')) {
        errorMessage = 'Invalid PDF response. Please try again.'
      }
    }
    
    toast.error(errorMessage, { id: toastId })
    return false
  }
}

/**
 * Print an invoice without downloading (for print-only operations)
 * @param options - Invoice print options
 * @returns Promise<boolean> - Success status
 */
export async function printInvoiceOnly({
  invoiceId,
  invoiceNumber,
  isDraft = false
}: DownloadInvoiceOptions): Promise<boolean> {
  return downloadAndPrintInvoice({
    invoiceId,
    invoiceNumber,
    isDraft,
    autoPrint: true,
    skipDownload: true
  })
}