import { useState } from 'react'
import { parseRosterCsv, type RosterRow } from '../lib/csv'
import { importRoster, type RosterRowResult } from '../lib/firestore'

export function RosterImport() {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<RosterRowResult[] | null>(null)

  async function onFile(file: File) {
    const text = await file.text()
    const { rows: parsed, error } = parseRosterCsv(text)
    setParseError(error)
    setRows(parsed)
    setResults(null)
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await importRoster(rows)
      setResults(res)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="font-serif text-lg font-semibold">Import Roster</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          One-time CSV upload: manager_name, manager_email, reportee_name, reportee_designation
        </p>
      </div>
      <div className="p-5 space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="text-sm"
        />
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

        {rows.length > 0 && !results && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">{rows.length} row(s) ready to import.</p>
            <table className="w-full text-xs border border-[var(--border)] rounded">
              <thead>
                <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Manager</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Reportee</th>
                  <th className="text-left px-3 py-2">Designation</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1.5">{r.manager_name}</td>
                    <td className="px-3 py-1.5">{r.manager_email}</td>
                    <td className="px-3 py-1.5">{r.reportee_name}</td>
                    <td className="px-3 py-1.5">{r.reportee_designation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {submitting ? 'Importing…' : 'Import roster'}
            </button>
          </div>
        )}

        {results && (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {results.filter((r) => r.status === 'created').length} created,{' '}
              {results.filter((r) => r.status === 'skipped').length} skipped
            </p>
            {results
              .filter((r) => r.status === 'skipped')
              .map((r) => (
                <p key={r.row} className="text-xs text-amber-700">
                  Row {r.row + 1}: {r.reason}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
