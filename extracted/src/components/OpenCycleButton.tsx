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
      <button onClick={() => setConfirming(true)} className="btn btn-outlined btn-md">
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
        className="ds-input"
        style={{ width: 160, height: 36 }}
      />
      <button onClick={open} disabled={busy || !label.trim()} className="btn btn-filled btn-md disabled:opacity-40 disabled:pointer-events-none">
        {busy ? 'Opening…' : 'Open cycle'}
      </button>
      <button onClick={() => setConfirming(false)} className="btn btn-outlined btn-md">
        Cancel
      </button>
    </div>
  )
}
