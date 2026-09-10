/**
 * Client-side CSV export helpers.
 * Builds an RFC 4180-ish CSV from string[][] rows and triggers a download.
 */

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) => row.map((cell) => csvEscape(cell === null || cell === undefined ? '' : String(cell))).join(','))
    .join('\r\n')
}

/** Trigger a browser download of `rows` as `<filename>.csv`. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** ISO date (yyyy-mm-dd) used to stamp exported filenames. */
export function csvDateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
