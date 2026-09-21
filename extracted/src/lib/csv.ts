/**
 * Minimal CSV parser for the fixed 4-column roster shape (U7). Handles
 * quoted fields with embedded commas; anything more exotic is out of scope
 * for a one-time admin upload of a small roster file.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  }
  return rows
}

export interface RosterRow {
  manager_name: string
  manager_email: string
  reportee_name: string
  reportee_designation: string
}

const EXPECTED_HEADER = ['manager_name', 'manager_email', 'reportee_name', 'reportee_designation']

export function parseRosterCsv(text: string): { rows: RosterRow[]; error: string | null } {
  const raw = parseCsv(text)
  if (raw.length === 0) return { rows: [], error: 'The file is empty.' }

  const header = raw[0].map((h) => h.trim().toLowerCase())
  const hasHeader = EXPECTED_HEADER.every((col) => header.includes(col))
  const dataRows = hasHeader ? raw.slice(1) : raw

  const rows: RosterRow[] = dataRows.map((cells) => ({
    manager_name: cells[0]?.trim() ?? '',
    manager_email: cells[1]?.trim() ?? '',
    reportee_name: cells[2]?.trim() ?? '',
    reportee_designation: cells[3]?.trim() ?? '',
  }))

  return { rows, error: null }
}
