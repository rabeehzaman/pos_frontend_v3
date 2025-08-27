// UOM (Unit of Measure) Handler for Zoho Books integration
// Handles conversions between different units like C6P, C12P, etc.

export interface UnitConversionInfo {
  type: 'carton' | 'bag' | 'piece' | 'other'
  piecesPerUnit: number
  display: string
  conversionId?: string
}

// Complete unit conversion mapping from Zoho Books (Saudi Arabia)
export const UNIT_CONVERSION_MAP = {
  "PIECES": "9465000000009224",
  "C2P": "9465000014396910",
  "C3P": "9465000000016009", 
  "C4P": "9465000000009276",
  "C5P": "9465000000009284",
  "C6P": "9465000000009236",
  "C8P": "9465000000009228",
  "C10P": "9465000000009232",
  "C12P": "9465000000009224",
  "C-12P": "9465000025261093",
  "C15P": "9465000000016001",
  "C16P": "9465000000009264",
  "C18P": "9465000000009260",
  "C20P": "9465000000009240",
  "C24P": "9465000000009248",
  "C-24P": "9465000025261136",
  "C25P": "9465000000009256",
  "C26P": "9465000000009288",
  "C30P": "9465000000009252",
  "C32P": "9465000000009296",
  "C35P": "9465000000016027",
  "C36P": "9465000000009280",
  "C40P": "9465000000009300",
  "C45P": "9465000000016031",
  "C48P": "9465000000009292",
  "C-48P": "9465000025261140",
  "C50P": "9465000000009268",
  "C60P": "9465000000009244",
  "C72P": "9465000000009272",
  "C80P": "9465000000016035",
  "C100P": "9465000000016005",
  "C140P": "9465000000016013",
  "C150P": "9465000000016017",
  "BAG(4)": "9465000006156003",
  "BAG(8)": "9465000000686132",
  "RAFTHA": "9465000000366030",
  "OUTER": "9465000000366098",
  // CTN has no conversion ID (returns empty array)
  // C3(RPT) has multiple conversions - handle separately if needed
} as const

export class UOMHandler {
  /**
   * Get unit conversion ID for Zoho Books API
   */
  static getUnitConversionId(unit: string): string | null {
    if (!unit) return null
    const conversionId = UNIT_CONVERSION_MAP[unit.toUpperCase() as keyof typeof UNIT_CONVERSION_MAP]
    console.log(`[UOM] Unit ${unit} -> Conversion ID: ${conversionId || 'NOT_FOUND'}`)
    return conversionId || null
  }

  /**
   * Parse unit and extract conversion information
   */
  static parseUnitInfo(unit: string): UnitConversionInfo | null {
    if (!unit) return null

    const upperUnit = unit.toUpperCase()
    console.log(`[UOM] Parsing unit: ${unit}`)

    // Handle carton patterns (C6P, C-12P, C24P, etc.)
    const cartonMatch = unit.match(/C-?(\d+)P(?:CS)?/i)
    if (cartonMatch) {
      const piecesPerCarton = parseInt(cartonMatch[1])
      return {
        type: 'carton',
        piecesPerUnit: piecesPerCarton,
        display: `1 Carton = ${piecesPerCarton} Pieces`,
        conversionId: this.getUnitConversionId(upperUnit) || undefined
      }
    }

    // Handle bag patterns
    if (upperUnit === 'BAG(4)') {
      return {
        type: 'bag',
        piecesPerUnit: 4,
        display: '1 Bag = 4 Pieces',
        conversionId: this.getUnitConversionId(upperUnit) || undefined
      }
    }

    if (upperUnit === 'BAG(8)') {
      return {
        type: 'bag', 
        piecesPerUnit: 8,
        display: '1 Bag = 8 Pieces',
        conversionId: this.getUnitConversionId(upperUnit) || undefined
      }
    }

    // Handle piece-based units
    if (['PIECES', 'RAFTHA', 'OUTER'].includes(upperUnit)) {
      return {
        type: 'piece',
        piecesPerUnit: 1,
        display: 'Sold as individual pieces',
        conversionId: this.getUnitConversionId(upperUnit) || undefined
      }
    }

    // Handle CTN (carton without piece count)
    if (upperUnit === 'CTN') {
      return {
        type: 'carton',
        piecesPerUnit: 0, // Unknown conversion
        display: 'Carton (conversion not available)',
        conversionId: null
      }
    }

    // Unknown unit
    console.log(`[UOM] Unknown unit pattern: ${unit}, treating as single unit`)
    return {
      type: 'other',
      piecesPerUnit: 1,
      display: `Sold as ${unit}`,
      conversionId: this.getUnitConversionId(upperUnit) || undefined
    }
  }

  /**
   * Check if unit has conversion capabilities
   */
  static hasUnitConversion(unit: string): boolean {
    if (!unit) return false
    const unitInfo = this.parseUnitInfo(unit)
    return !!(unitInfo && unitInfo.piecesPerUnit > 0 && unitInfo.conversionId)
  }

  /**
   * Get pieces per unit for quantity calculations
   */
  static getPiecesPerUnit(unit: string): number {
    const unitInfo = this.parseUnitInfo(unit)
    return unitInfo?.piecesPerUnit || 1
  }

  /**
   * Convert quantity between units
   * @param quantity - Quantity to convert
   * @param fromUnit - Source unit (e.g., 'cartons', 'pieces')
   * @param toUnit - Target unit (e.g., 'pieces', 'cartons')  
   * @param itemUnit - The item's base unit (e.g., 'C12P')
   */
  static convertQuantity(
    quantity: number, 
    fromUnit: 'cartons' | 'pieces', 
    toUnit: 'cartons' | 'pieces', 
    itemUnit: string
  ): number {
    if (fromUnit === toUnit) return quantity

    const unitInfo = this.parseUnitInfo(itemUnit)
    if (!unitInfo || unitInfo.piecesPerUnit <= 0) {
      console.log(`[UOM] No conversion available for ${itemUnit}`)
      return quantity
    }

    const piecesPerUnit = unitInfo.piecesPerUnit

    if (fromUnit === 'pieces' && toUnit === 'cartons') {
      const result = quantity / piecesPerUnit
      console.log(`[UOM] Converting ${quantity} pieces to ${result} cartons (${itemUnit})`)
      return result
    }

    if (fromUnit === 'cartons' && toUnit === 'pieces') {
      const result = quantity * piecesPerUnit
      console.log(`[UOM] Converting ${quantity} cartons to ${result} pieces (${itemUnit})`)
      return result
    }

    return quantity
  }

  /**
   * Format unit display string for UI
   */
  static formatUnitDisplay(unit: string, quantity: number = 1): string {
    const unitInfo = this.parseUnitInfo(unit)
    
    if (!unitInfo) {
      return `${quantity} ${unit}`
    }

    switch (unitInfo.type) {
      case 'carton':
        if (unitInfo.piecesPerUnit > 0) {
          const pieces = quantity * unitInfo.piecesPerUnit
          return `${quantity} Carton${quantity !== 1 ? 's' : ''} (${pieces} pieces)`
        }
        return `${quantity} Carton${quantity !== 1 ? 's' : ''}`
      
      case 'bag':
        const pieces = quantity * unitInfo.piecesPerUnit
        return `${quantity} Bag${quantity !== 1 ? 's' : ''} (${pieces} pieces)`
      
      case 'piece':
        return `${quantity} ${unit}`
      
      default:
        return `${quantity} ${unit}`
    }
  }

  /**
   * Calculate total pieces for inventory management
   */
  static calculateTotalPieces(quantity: number, unit: string): number {
    const piecesPerUnit = this.getPiecesPerUnit(unit)
    return quantity * piecesPerUnit
  }

  /**
   * Get all supported units for a dropdown/selector
   */
  static getSupportedUnits(): Array<{value: string, label: string, category: string}> {
    return [
      // Cartons
      { value: 'C3P', label: 'C3P (3 pieces per carton)', category: 'Cartons' },
      { value: 'C6P', label: 'C6P (6 pieces per carton)', category: 'Cartons' },
      { value: 'C12P', label: 'C12P (12 pieces per carton)', category: 'Cartons' },
      { value: 'C24P', label: 'C24P (24 pieces per carton)', category: 'Cartons' },
      { value: 'C48P', label: 'C48P (48 pieces per carton)', category: 'Cartons' },
      
      // Bags
      { value: 'BAG(4)', label: 'BAG(4) (4 pieces per bag)', category: 'Bags' },
      { value: 'BAG(8)', label: 'BAG(8) (8 pieces per bag)', category: 'Bags' },
      
      // Individual units
      { value: 'PIECES', label: 'Pieces', category: 'Individual' },
      { value: 'RAFTHA', label: 'Raftha', category: 'Individual' },
      { value: 'OUTER', label: 'Outer', category: 'Individual' },
    ]
  }
}