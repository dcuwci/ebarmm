/**
 * Export utilities for CSV download
 */

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If the value contains special characters, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Export data to CSV and trigger download
 *
 * @param data - Array of objects to export
 * @param filename - Name of the downloaded file (without extension)
 * @param headers - Optional custom headers mapping (key -> display name)
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers?: Record<string, string>
): void {
  if (!data.length) {
    console.warn('No data to export')
    return
  }

  // Get all keys from first object (assumes consistent structure)
  const keys = Object.keys(data[0])

  // Create header row
  const headerRow = keys.map((key) => headers?.[key] || key).join(',')

  // Create data rows
  const dataRows = data.map((row) =>
    keys.map((key) => escapeCSVValue(row[key])).join(',')
  )

  // Combine with BOM for Excel compatibility
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Format currency for export (plain number without symbol)
 */
export function formatCurrencyForExport(value: number): string {
  return value.toFixed(2)
}

/**
 * Format percentage for export
 */
export function formatPercentForExport(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Format date for export (ISO format)
 */
export function formatDateForExport(date: string | Date | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}
