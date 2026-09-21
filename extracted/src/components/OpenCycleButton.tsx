import { useState } from 'react'
import { openCycle } from '../lib/firestore'

export function OpenCycleButton() {
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function open() {
    if (!label.trim()) return
    setBusy(true)
    try {
      await openCycle(label.trim())
      setLabel('')
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-md hover:bg-[var(--secondary)] transition-colors"
      >
        + Open new cycle
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        placeholder="e.g. Oct 2026"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="border border-[var(--border)] rounded px-3 py-1.5 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
      />
      <button
        onClick={open}
        disabled={busy || !label.trim()}
        className="px-3 py-1.5 bg-[var(--primary)] text-white text-sm rounded disabled:opacity-40"
      >
        {busy ? 'Opening…' : 'Open cycle'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="px-3 py-1.5 border border-[var(--border)] text-sm rounded"
      >
        Cancel
      </button>
    </div>
  )
}
