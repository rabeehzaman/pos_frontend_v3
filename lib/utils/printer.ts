'use client'

import { toast } from 'sonner'
import printJS from 'print-js'

// Type definition for print-js configuration
interface PrintJSConfig {
  printable: string | Blob
  type: 'pdf' | 'html' | 'image' | 'json'
  base64?: boolean
  showModal?: boolean
  modalMessage?: string
  header?: string
  headerStyle?: string
  documentTitle?: string
  fallbackPrintable?: string
  onPrintDialogClose?: () => void
  onError?: (error: Error) => void
  font_size?: string
  css?: string | string[]
  style?: string
  scanStyles?: boolean
  targetStyle?: string | string[]
  targetStyles?: string | string[]
  ignoreElements?: string | string[]
}

// Check if print-js is available in browser environment
function getPrintJS(): (config: PrintJSConfig) => void {
  if (typeof window === 'undefined') {
    throw new Error('print-js can only be used in browser environment')
  }
  
  if (!printJS) {
    throw new Error('print-js library not loaded')
  }
  
  return printJS
}

export interface PrinterSettings {
  autoPrint: boolean
  silentPrint: boolean
  numberOfCopies: number
  printAfterInvoice: boolean
  testPrintEnabled: boolean
}

export interface PrintOptions {
  documentTitle?: string
  copies?: number
  silent?: boolean
  showModal?: boolean
}

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  autoPrint: false,
  silentPrint: true,
  numberOfCopies: 1,
  printAfterInvoice: false,
  testPrintEnabled: true
}

// Storage key for printer settings
const PRINTER_SETTINGS_KEY = 'tmr_pos_printer_settings'

/**
 * Get printer settings from localStorage
 */
export function getPrinterSettings(): PrinterSettings {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return DEFAULT_PRINTER_SETTINGS
    }
    
    const saved = localStorage.getItem(PRINTER_SETTINGS_KEY)
    if (saved) {
      return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) }
    }
    return DEFAULT_PRINTER_SETTINGS
  } catch (error) {
    console.error('Failed to load printer settings:', error)
    return DEFAULT_PRINTER_SETTINGS
  }
}

/**
 * Save printer settings to localStorage
 */
export function savePrinterSettings(settings: Partial<PrinterSettings>): void {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    
    const current = getPrinterSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Failed to save printer settings:', error)
    toast.error('Failed to save printer settings')
  }
}

/**
 * Print a PDF blob using print-js
 * @param pdfBlob - The PDF blob to print
 * @param options - Print options
 * @returns Promise<boolean> - Success status
 */
export async function printPDFBlob(
  pdfBlob: Blob, 
  options: PrintOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const {
        documentTitle = 'Invoice',
        copies = 1,
        silent = true,
        showModal = false
      } = options

      const settings = getPrinterSettings()
      const actualCopies = copies || settings.numberOfCopies
      const actualSilent = silent && settings.silentPrint

      console.log(`Printing ${documentTitle} - Copies: ${actualCopies}, Silent: ${actualSilent}`)

      // Convert blob to object URL for print-js
      const pdfUrl = URL.createObjectURL(pdfBlob)

      try {
        const printJSFunc = getPrintJS()
        
        printJSFunc({
          printable: pdfUrl,
          type: 'pdf',
          showModal: showModal || !actualSilent,
          modalMessage: actualSilent ? 'Printing invoice...' : 'Preparing to print...',
          documentTitle: documentTitle,
          onPrintDialogClose: () => {
            URL.revokeObjectURL(pdfUrl)
            console.log(`Print dialog closed for ${documentTitle}`)
          },
          onError: (error: Error) => {
            console.error('Print error:', error)
            URL.revokeObjectURL(pdfUrl)
            toast.error('Printing failed. Please try again.')
            resolve(false)
          }
        })

        // For multiple copies, we need to print multiple times
        if (actualCopies > 1) {
          for (let i = 1; i < actualCopies; i++) {
            setTimeout(() => {
              printJSFunc({
                printable: pdfUrl,
                type: 'pdf',
                showModal: false,
                onError: (error: Error) => {
                  console.error(`Print copy ${i + 1} error:`, error)
                }
              })
            }, i * 1000) // Delay each copy by 1 second
          }
        }

        // Clean up after a delay to ensure printing completes
        setTimeout(() => {
          URL.revokeObjectURL(pdfUrl)
        }, 5000)

        resolve(true)

      } catch (error) {
        console.error('Print-js error:', error)
        URL.revokeObjectURL(pdfUrl)
        
        // Fallback to browser print dialog
        const fallbackWindow = window.open(pdfUrl, '_blank')
        if (fallbackWindow) {
          fallbackWindow.onload = () => {
            fallbackWindow.print()
            fallbackWindow.close()
          }
          resolve(true)
        } else {
          toast.error('Failed to open print dialog. Please check popup blocker.')
          resolve(false)
        }
      }

    } catch (error) {
      console.error('Print setup error:', error)
      toast.error('Failed to setup printing. Please try again.')
      resolve(false)
    }
  })
}

/**
 * Print an invoice by fetching it from the API
 * @param invoiceId - The invoice ID
 * @param invoiceNumber - The invoice number for display
 * @param options - Print options
 * @returns Promise<boolean> - Success status
 */
export async function printInvoice(
  invoiceId: string,
  invoiceNumber: string,
  options: PrintOptions = {}
): Promise<boolean> {
  const toastId = toast.loading(`Preparing to print invoice ${invoiceNumber}...`)

  try {
    // Fetch the invoice PDF
    const response = await fetch(`/api/invoices/${invoiceId}/download`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch invoice: ${response.statusText}`)
    }

    const pdfBlob = await response.blob()
    
    if (!pdfBlob.type.includes('pdf')) {
      throw new Error('Downloaded file is not a PDF')
    }

    toast.success(`Printing invoice ${invoiceNumber}...`, { id: toastId })

    const success = await printPDFBlob(pdfBlob, {
      ...options,
      documentTitle: `Invoice ${invoiceNumber}`
    })

    if (success) {
      toast.success(`Invoice ${invoiceNumber} sent to printer!`, { id: toastId })
    } else {
      toast.error(`Failed to print invoice ${invoiceNumber}`, { id: toastId })
    }

    return success

  } catch (error) {
    console.error('Print invoice error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    toast.error(`Failed to print invoice: ${errorMessage}`, { id: toastId })
    return false
  }
}

/**
 * Print a test page to check printer connectivity
 * @returns Promise<boolean> - Success status
 */
export async function printTestPage(): Promise<boolean> {
  const toastId = toast.loading('Printing test page...')

  try {
    const testPageContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">
          POS Printer Test
        </h1>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Test Status:</strong> SUCCESS</p>
        <p>If you can see this page clearly, your printer is working correctly.</p>
        <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; background-color: #f9f9f9;">
          <h3>System Information:</h3>
          <p><strong>Browser:</strong> ${navigator.userAgent}</p>
          <p><strong>Platform:</strong> ${navigator.platform}</p>
          <p><strong>Language:</strong> ${navigator.language}</p>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">
          TMR POS System - Printer Test Page
        </p>
      </div>
    `

    try {
      const printJSFunc = getPrintJS()
      
      return new Promise((resolve) => {
        printJSFunc({
          printable: testPageContent,
          type: 'html',
          showModal: true,
          modalMessage: 'Preparing test page...',
          documentTitle: 'POS Printer Test',
          header: 'Printer Test Page',
          headerStyle: 'font-size: 20px; font-weight: bold; color: #333;',
          style: 'body { font-family: Arial, sans-serif; }',
          onPrintDialogClose: () => {
            console.log('Test print dialog closed')
          },
          onError: (error: Error) => {
            console.error('Test print error:', error)
            toast.error('Test print failed. Please check your printer.', { id: toastId })
            resolve(false)
          }
        })

        toast.success('Test page sent to printer!', { id: toastId })
        resolve(true)
      })

    } catch (error) {
      console.error('Test print setup error:', error)
      toast.error('Failed to setup test print.', { id: toastId })
      return false
    }

  } catch (error) {
    console.error('Test print error:', error)
    toast.error('Failed to print test page.', { id: toastId })
    return false
  }
}

/**
 * Check if auto-print is enabled for new invoices
 */
export function shouldAutoPrintInvoice(): boolean {
  const settings = getPrinterSettings()
  return settings.autoPrint && settings.printAfterInvoice
}

/**
 * Print an invoice automatically if settings allow
 * @param invoiceId - The invoice ID
 * @param invoiceNumber - The invoice number
 * @param delay - Delay before printing (default: 2000ms)
 */
export async function autoPrintInvoice(
  invoiceId: string,
  invoiceNumber: string,
  delay: number = 2000
): Promise<boolean> {
  if (!shouldAutoPrintInvoice()) {
    console.log('Auto-print disabled, skipping print')
    return false
  }

  return new Promise((resolve) => {
    setTimeout(async () => {
      const settings = getPrinterSettings()
      const success = await printInvoice(invoiceId, invoiceNumber, {
        silent: settings.silentPrint,
        copies: settings.numberOfCopies
      })
      resolve(success)
    }, delay)
  })
}

/**
 * Reset printer settings to defaults
 */
export function resetPrinterSettings(): void {
  try {
    localStorage.removeItem(PRINTER_SETTINGS_KEY)
    toast.success('Printer settings reset to defaults')
  } catch (error) {
    console.error('Failed to reset printer settings:', error)
    toast.error('Failed to reset printer settings')
  }
}