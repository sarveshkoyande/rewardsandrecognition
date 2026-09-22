import { useRef, useState } from 'react'
import { downloadCsv, parseRosterCsv, toCsv, type RosterRow } from '../lib/csv'
import { importRoster, type RosterRowResult } from '../lib/firestore'

const TEMPLATE_HEADERS = ['manager_name', 'manager_email', 'reportee_name', 'reportee_designation']

export function RosterImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<RosterRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<RosterRowResult[] | null>(null)

  async function onFile(file: File) {
    setFileName(file.name)
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

  function downloadTemplate() {
    downloadCsv('roster-template.csv', toCsv(TEMPLATE_HEADERS, []))
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="ds-title-m">Import Roster</h2>
        <p className="ds-body-s text-[var(--muted-foreground)] mt-0.5">
          One-time CSV upload: manager_name, manager_email, reportee_name, reportee_designation
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="hidden"
          />
          <button className="btn btn-outlined btn-md" onClick={() => fileInputRef.current?.click()}>
            Choose CSV file
          </button>
          <span className="ds-body-s text-[var(--muted-foreground)]">{fileName ?? 'No file chosen'}</span>
          <button className="btn btn-text btn-md" onClick={downloadTemplate}>
            Download empty template
          </button>
        </div>
        {parseError && <p className="ds-body-s text-[var(--error-foreground)]">{parseError}</p>}

        {rows.length > 0 && !results && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">{rows.length} row(s) ready to import.</p>
            <table className="w-full ds-body-s border border-[var(--border)] rounded-[var(--radius-xs)]">
              <thead>
                <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] ds-label-m uppercase">
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
            <button onClick={submit} disabled={submitting} className="btn btn-filled btn-md disabled:opacity-40 disabled:pointer-events-none">
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
                <p key={r.row} className="ds-body-s text-[var(--warning-foreground)]">
                  Row {r.row + 1}: {r.reason}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
