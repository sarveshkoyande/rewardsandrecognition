import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { SignInScreen } from './components/SignInScreen'
import { BlockedScreen } from './components/BlockedScreen'
import { VerifyEmailScreen } from './components/VerifyEmailScreen'
import { RosterImport } from './components/RosterImport'
import { OpenCycleButton } from './components/OpenCycleButton'
import { downloadCsv, toCsv } from './lib/csv'
import {
  addManager as createManager,
  addReportee as createReportee,
  giveAward,
  removeReportee,
  setMyAllocation,
  subscribeAllocations,
  subscribeAwards,
  subscribeCurrentCycle,
  subscribeCycles,
  subscribeManager,
  subscribeManagers,
  subscribeReportees,
  type Allocation,
  type Award,
  type CreditType,
  type CurrentCycle,
  type Cycle,
  type Manager,
  type Reportee,
} from './lib/firestore'

const CREDIT_TYPE_LABEL: Record<CreditType, string> = { spark: 'Spark', beacon: 'Beacon' }
const CREDIT_TYPE_VERB: Record<CreditType, string> = { spark: 'Awarded', beacon: 'Nominated' }

// A manager combined with this cycle's self-reported totals, matching the
// shape the dashboard/people/manager views render against.
interface ManagerWithData extends Manager {
  sparkTotal: number
  beaconTotal: number
  hasReported: boolean
  reportees: Reportee[]
  currentCycleId?: string
}

interface AwardWithLabel extends Award {
  cycleLabel: string
}

function exportAwardsCsv(awards: AwardWithLabel[], filenamePrefix: string) {
  const csv = toCsv(
    ['Type', 'Recipient', 'Awarded By', 'Date'],
    [...awards]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((a) => [CREDIT_TYPE_LABEL[a.type], a.recipientName, a.managerName, a.date])
  )
  downloadCsv(`${filenamePrefix}.csv`, csv)
}

function TypeTag({ type }: { type: CreditType }) {
  return <span className={`tag ${type === 'spark' ? 'tag-solid tag-warning' : 'tag-solid tag-info'}`}>{CREDIT_TYPE_LABEL[type]}</span>
}

function CycleBadge({ label, isCurrent }: { label: string; isCurrent: boolean }) {
  return <span className={`tag ds-tabular ${isCurrent ? 'tag-solid tag-primary' : 'tag-neutral'}`}>{label}</span>
}

function CreditPips({ total, used }: { total: number; used: number }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            i < used ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-transparent border-[var(--border)]'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Admin: Overview ──────────────────────────────────────────────────────────
type ManagerCreditSortKey = 'name' | 'team' | 'sparkReported' | 'sparkGiven' | 'sparkPending' | 'beaconReported' | 'beaconGiven'

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  align,
  onSort,
}: {
  label: string
  sortKey: ManagerCreditSortKey
  active: boolean
  dir: 'asc' | 'desc'
  align: 'left' | 'center'
  onSort: (key: ManagerCreditSortKey) => void
}) {
  return (
    <th className={`px-5 py-3 ${align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
      >
        {label}
        <span style={{ opacity: active ? 1 : 0.3 }}>{active && dir === 'asc' ? '▲' : '▼'}</span>
      </button>
    </th>
  )
}

function AdminDashboard({
  managers,
  awards,
  currentCycleLabel,
}: {
  managers: ManagerWithData[]
  awards: AwardWithLabel[]
  currentCycleLabel: string
}) {
  const currentAwards = awards.filter((a) => a.cycleLabel === currentCycleLabel)
  const sparkGiven = currentAwards.filter((a) => a.type === 'spark').length
  const beaconGiven = currentAwards.filter((a) => a.type === 'beacon').length
  const reportedCount = managers.filter((m) => m.hasReported).length

  const [sortKey, setSortKey] = useState<ManagerCreditSortKey>('sparkPending')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: ManagerCreditSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Numeric columns read most-useful highest-first by default; the name
      // column reads alphabetically (A→Z) by default.
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const creditRows = managers.map((m) => {
    const sparkGivenByManager = currentAwards.filter((a) => a.managerId === m.id && a.type === 'spark').length
    const beaconGivenByManager = currentAwards.filter((a) => a.managerId === m.id && a.type === 'beacon').length
    return {
      manager: m,
      team: m.reportees.length,
      sparkReported: m.sparkTotal,
      sparkGiven: sparkGivenByManager,
      sparkPending: m.sparkTotal - sparkGivenByManager,
      beaconReported: m.beaconTotal,
      beaconGiven: beaconGivenByManager,
    }
  })

  const sortedCreditRows = [...creditRows].sort((a, b) => {
    const dirMul = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'name') return a.manager.name.localeCompare(b.manager.name) * dirMul
    return (a[sortKey] - b[sortKey]) * dirMul
  })

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Spark Awards Given', value: sparkGiven, sub: currentCycleLabel },
          { label: 'Beacon Nominations', value: beaconGiven, sub: currentCycleLabel },
          { label: 'Managers Reporting Credits', value: `${reportedCount}/${managers.length}`, sub: 'have set their totals this cycle' },
        ].map((k) => (
          <div key={k.label} className="ds-card p-5">
            <p className="ds-label-m uppercase text-[var(--muted-foreground)] mb-1">{k.label}</p>
            <p className="ds-display-s text-[var(--foreground)]">{k.value}</p>
            <p className="ds-body-s text-[var(--muted-foreground)] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="ds-title-m">Manager Credits — {currentCycleLabel}</h2>
          <p className="ds-body-s text-[var(--muted-foreground)] mt-0.5">Spark is capped by what's reported; Beacon nominations don't consume credit</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] ds-label-m uppercase">
              <SortHeader label="Manager" sortKey="name" align="left" active={sortKey === 'name'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Team" sortKey="team" align="center" active={sortKey === 'team'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Spark Reported" sortKey="sparkReported" align="center" active={sortKey === 'sparkReported'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Spark Given" sortKey="sparkGiven" align="center" active={sortKey === 'sparkGiven'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Spark Pending" sortKey="sparkPending" align="center" active={sortKey === 'sparkPending'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Beacon Reported" sortKey="beaconReported" align="center" active={sortKey === 'beaconReported'} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Beacon Given" sortKey="beaconGiven" align="center" active={sortKey === 'beaconGiven'} dir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedCreditRows.map((row, i) => (
              <tr key={row.manager.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                <td className="px-5 py-3">
                  <p className="font-medium">{row.manager.name}</p>
                  {!row.manager.hasReported && <span className="tag tag-neutral" style={{ marginTop: 2 }}>Not reported yet</span>}
                </td>
                <td className="px-5 py-3 text-center ds-tabular text-[var(--muted-foreground)]">{row.team}</td>
                <td className="px-5 py-3 text-center ds-tabular">{row.sparkReported}</td>
                <td className="px-5 py-3 text-center ds-tabular text-[var(--primary)]">{row.sparkGiven}</td>
                <td className="px-5 py-3 text-center ds-tabular text-[var(--success-foreground)] font-semibold">{row.sparkPending}</td>
                <td className="px-5 py-3 text-center ds-tabular">{row.beaconReported}</td>
                <td className="px-5 py-3 text-center ds-tabular text-[var(--primary)]">{row.beaconGiven}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="ds-title-m">Activity — {currentCycleLabel}</h2>
            <p className="ds-body-s text-[var(--muted-foreground)] mt-0.5">Every Spark award and Beacon nomination this cycle, most recent first</p>
          </div>
          <div className="flex items-center gap-2">
            {currentAwards.length > 0 && (
              <button className="btn btn-outlined btn-md" onClick={() => exportAwardsCsv(currentAwards, `activity-${currentCycleLabel}`)}>
                Export CSV
              </button>
            )}
            <OpenCycleButton />
          </div>
        </div>
        {currentAwards.length === 0 ? (
          <p className="px-5 py-10 text-sm text-[var(--muted-foreground)] text-center">Nothing recorded yet this cycle.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] ds-label-m uppercase">
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Recipient</th>
                <th className="text-left px-5 py-3">By</th>
                <th className="text-right px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {[...currentAwards].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                  <td className="px-5 py-3"><TypeTag type={a.type} /></td>
                  <td className="px-5 py-3 font-medium">{a.recipientName}</td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{a.managerName}</td>
                  <td className="px-5 py-3 text-right ds-tabular text-xs text-[var(--muted-foreground)]">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <HistoryTable
        awards={awards.filter((a) => a.cycleLabel !== currentCycleLabel)}
        title="Past Activity — Previous Cycles"
        currentCycleLabel={currentCycleLabel}
      />
    </div>
  )
}

// ─── Admin: People ────────────────────────────────────────────────────────────
function AdminPeopleView({ managers }: { managers: ManagerWithData[] }) {
  const [addManager, setAddManager] = useState(false)
  const [newManager, setNewManager] = useState({ name: '', designation: '', email: '' })
  const [addReportee, setAddReportee] = useState<string | null>(null)
  const [newReportee, setNewReportee] = useState({ name: '', designation: '' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="ds-headline-s">People & Structure</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Manage managers and reportees. Managers report their own Spark and Beacon totals each cycle.</p>
        </div>
        <button onClick={() => setAddManager(true)} className="btn btn-filled btn-md">
          + Add Manager
        </button>
      </div>

      <RosterImport />

      {addManager && (
        <div className="ds-card p-5" style={{ boxShadow: '0 0 0 1px var(--primary), var(--elevation-02)' }}>
          <h3 className="ds-title-m mb-3">New Manager</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input autoFocus className="ds-input" placeholder="Full name" value={newManager.name} onChange={(e) => setNewManager({ ...newManager, name: e.target.value })} />
            <input className="ds-input" placeholder="Google email" value={newManager.email} onChange={(e) => setNewManager({ ...newManager, email: e.target.value })} />
            <input className="ds-input" placeholder="Designation" value={newManager.designation} onChange={(e) => setNewManager({ ...newManager, designation: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-filled btn-sm"
              onClick={async () => {
                if (newManager.name.trim() && newManager.email.trim()) {
                  await createManager(newManager.email, newManager.name, newManager.designation)
                  setNewManager({ name: '', designation: '', email: '' })
                  setAddManager(false)
                }
              }}
            >Add</button>
            <button className="btn btn-outlined btn-sm" onClick={() => setAddManager(false)}>Cancel</button>
          </div>
        </div>
      )}

      {managers.map((m) => (
        <div key={m.id} className="ds-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)]/40">
            <div>
              <p className="font-semibold">{m.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{m.designation} · {m.reportees.length} reportees</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">This cycle's credits (self-reported)</p>
              {m.hasReported ? (
                <p className="ds-tabular font-bold text-sm">Spark {m.sparkTotal} · Beacon {m.beaconTotal}</p>
              ) : (
                <span className="tag tag-neutral">Not reported yet</span>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="ds-label-m uppercase text-[var(--muted-foreground)]">
                <th className="text-left px-5 py-2.5">Reportee</th>
                <th className="text-left px-5 py-2.5">Designation</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {m.reportees.map((r, i) => (
                <tr key={r.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/20' : ''}`}>
                  <td className="px-5 py-2.5 font-medium">{r.name}</td>
                  <td className="px-5 py-2.5 text-[var(--muted-foreground)]">{r.designation}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button className="btn btn-text btn-sm" style={{ color: 'var(--error-foreground)' }} onClick={() => removeReportee(r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {addReportee === m.id ? (
                <tr className="border-t border-[var(--border)] bg-[var(--primary-light-background)]/60">
                  <td className="px-5 py-2.5">
                    <input autoFocus className="ds-input" style={{ height: 32, padding: '0 var(--spacing-8)' }} placeholder="Full name" value={newReportee.name} onChange={(e) => setNewReportee({ ...newReportee, name: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5">
                    <input className="ds-input" style={{ height: 32, padding: '0 var(--spacing-8)' }} placeholder="Designation" value={newReportee.designation} onChange={(e) => setNewReportee({ ...newReportee, designation: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn btn-filled btn-sm"
                        onClick={async () => {
                          if (newReportee.name.trim()) {
                            await createReportee(m.id, newReportee.name, newReportee.designation)
                            setNewReportee({ name: '', designation: '' })
                            setAddReportee(null)
                          }
                        }}
                      >Add</button>
                      <button className="btn btn-outlined btn-sm" onClick={() => { setAddReportee(null); setNewReportee({ name: '', designation: '' }) }}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={3} className="px-5 py-2">
                    <button className="btn btn-text btn-sm" onClick={() => setAddReportee(m.id)}>+ Add reportee</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── History table (shared) -- each past cycle is its own expandable group ────
function HistoryTable({ awards, title, currentCycleLabel }: { awards: AwardWithLabel[]; title: string; currentCycleLabel: string }) {
  const [openCycle, setOpenCycle] = useState<string | null>(null)
  if (awards.length === 0) return null
  const grouped = awards.reduce<Record<string, AwardWithLabel[]>>((acc, a) => {
    ;(acc[a.cycleLabel] = acc[a.cycleLabel] || []).push(a)
    return acc
  }, {})

  return (
    <div className="ds-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="ds-title-m">{title}</h2>
        <p className="ds-body-s text-[var(--muted-foreground)] mt-0.5">Reference this to avoid repeating the same recognition</p>
      </div>
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([cycle, cycleAwards]) => {
          const isOpen = openCycle === cycle
          return (
            <div key={cycle} className="border-t border-[var(--border)]">
              <button
                className="w-full px-5 py-3 bg-[var(--secondary)]/60 flex items-center justify-between gap-2"
                onClick={() => setOpenCycle(isOpen ? null : cycle)}
              >
                <span className="flex items-center gap-2">
                  <span className="ds-tabular" style={{ display: 'inline-block', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
                  <CycleBadge label={cycle} isCurrent={cycle === currentCycleLabel} />
                  <span className="ds-label-s text-[var(--muted-foreground)]">{cycleAwards.length} item{cycleAwards.length !== 1 ? 's' : ''}</span>
                </span>
                <span
                  role="button"
                  className="btn btn-text btn-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    exportAwardsCsv(cycleAwards, `activity-${cycle}`)
                  }}
                >
                  Export CSV
                </span>
              </button>
              {isOpen && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="ds-label-m uppercase text-[var(--muted-foreground)]">
                      <th className="text-left px-5 py-2">Type</th>
                      <th className="text-left px-5 py-2">Recipient</th>
                      <th className="text-left px-5 py-2">By</th>
                      <th className="text-right px-5 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cycleAwards].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                      <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/20' : ''}`}>
                        <td className="px-5 py-3"><TypeTag type={a.type} /></td>
                        <td className="px-5 py-3 font-medium">{a.recipientName}</td>
                        <td className="px-5 py-3 text-[var(--muted-foreground)] ds-body-s">{a.managerName}</td>
                        <td className="px-5 py-3 text-right ds-tabular text-xs text-[var(--muted-foreground)] whitespace-nowrap">{a.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
    </div>
  )
}

// ─── Manager: set own credits ───────────────────────────────────────────────────
function SetCreditsForm({
  cycleLabel,
  initialSpark,
  initialBeacon,
  onSave,
}: {
  cycleLabel: string
  initialSpark: number
  initialBeacon: number
  onSave: (spark: number, beacon: number) => Promise<void>
}) {
  const [spark, setSpark] = useState(String(initialSpark || ''))
  const [beacon, setBeacon] = useState(String(initialBeacon || ''))
  const [saving, setSaving] = useState(false)

  async function save() {
    const s = parseInt(spark)
    const b = parseInt(beacon)
    if (isNaN(s) || s < 0 || isNaN(b) || b < 0) return
    setSaving(true)
    try {
      await onSave(s, b)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ds-card p-5">
      <h2 className="ds-title-m mb-1">Your Credits — {cycleLabel}</h2>
      <p className="ds-body-s text-[var(--muted-foreground)] mb-4">
        Enter how many Spark and Beacon credits you've been allocated this cycle.
      </p>
      <div className="flex items-end gap-3">
        <div>
          <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Spark credits</label>
          <input type="number" className="ds-input" style={{ width: 120 }} value={spark} onChange={(e) => setSpark(e.target.value)} />
        </div>
        <div>
          <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Beacon credits</label>
          <input type="number" className="ds-input" style={{ width: 120 }} value={beacon} onChange={(e) => setBeacon(e.target.value)} />
        </div>
        <button className="btn btn-filled btn-md disabled:opacity-40 disabled:pointer-events-none" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Manager View ─────────────────────────────────────────────────────────────
function ManagerView({
  manager,
  awards,
  currentCycle,
  onGiveAward,
  onSetCredits,
}: {
  manager: ManagerWithData
  awards: AwardWithLabel[]
  currentCycle: CurrentCycle
  onGiveAward: (type: CreditType, recipientId: string, recipientName: string) => Promise<void>
  onSetCredits: (spark: number, beacon: number) => Promise<void>
}) {
  const [editingCredits, setEditingCredits] = useState(false)
  const myCurrentAwards = awards.filter((a) => a.cycleId === currentCycle.cycleId)
  const sparkUsed = myCurrentAwards.filter((a) => a.type === 'spark').length
  const beaconUsed = myCurrentAwards.filter((a) => a.type === 'beacon').length
  const sparkRemaining = manager.sparkTotal - sparkUsed

  const [form, setForm] = useState({ type: 'spark' as CreditType, recipientId: '' })
  const [success, setSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Beacon nominations don't consume a credit (stakeholder feedback,
  // 2026-09-22) -- Spark still does. Beacon's reported total is informational
  // only, never a gate.
  const isCapped = form.type === 'spark'
  const remaining = isCapped ? sparkRemaining : null
  const blocked = isCapped && sparkRemaining <= 0
  const givenThisType = new Set(myCurrentAwards.filter((a) => a.type === form.type).map((a) => a.recipientId))

  async function submit() {
    const rep = manager.reportees.find((r) => r.id === form.recipientId)
    if (!rep || blocked) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onGiveAward(form.type, rep.id, rep.name)
      setForm({ ...form, recipientId: '' })
      setSuccess(rep.name)
      setTimeout(() => setSuccess(null), 4000)
    } catch {
      setSubmitError("Couldn't record this -- your cycle may be out of date. Refresh and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!manager.hasReported || editingCredits) {
    return (
      <div className="max-w-3xl">
        <SetCreditsForm
          cycleLabel={currentCycle.label}
          initialSpark={manager.sparkTotal}
          initialBeacon={manager.beaconTotal}
          onSave={async (s, b) => {
            await onSetCredits(s, b)
            setEditingCredits(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="ds-card p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="ds-label-m uppercase text-[var(--muted-foreground)]">Spark — {currentCycle.label}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="ds-display-s text-[var(--foreground)]">{sparkRemaining}</p>
            <p className="text-[var(--muted-foreground)] text-sm">/ {manager.sparkTotal} remaining</p>
          </div>
          <CreditPips total={manager.sparkTotal} used={sparkUsed} />
        </div>
        <div className="ds-card p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="ds-label-m uppercase text-[var(--muted-foreground)]">Beacon — {currentCycle.label}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="ds-display-s text-[var(--foreground)]">{beaconUsed}</p>
            <p className="text-[var(--muted-foreground)] text-sm">nominated · {manager.beaconTotal} reported</p>
          </div>
          <p className="ds-body-s text-[var(--muted-foreground)] mt-1">Nominations don't use up a credit</p>
        </div>
      </div>
      <button className="btn btn-text btn-sm" onClick={() => setEditingCredits(true)}>Edit my credit totals</button>

      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="ds-title-m">Give Spark or Nominate for Beacon</h2>
          <p className="ds-body-s text-[var(--muted-foreground)] mt-0.5">A Spark award uses 1 credit · a Beacon nomination doesn't · each team member can receive one of each per cycle</p>
        </div>
        <div className="p-5 space-y-4">
          {success && (
            <div className="bg-[var(--success-light-background)] border border-[var(--success-foreground)]/20 text-[var(--success-foreground)] text-sm px-4 py-3 rounded-[var(--radius-sm)] flex items-center gap-2">
              <span>🏆</span> {CREDIT_TYPE_VERB[form.type]} <strong>{success}</strong>
              {isCapped ? ` — ${remaining} Spark credit${remaining !== 1 ? 's' : ''} remaining` : ''}
            </div>
          )}
          {submitError && (
            <div className="bg-[var(--error-light-background)] border border-[var(--error-foreground)]/20 text-[var(--error-foreground)] text-sm px-4 py-3 rounded-[var(--radius-sm)]">
              {submitError}
            </div>
          )}
          {blocked && (
            <div className="bg-[var(--warning-light-background)] border border-[var(--warning-foreground)]/20 text-[var(--warning-foreground)] text-sm px-4 py-3 rounded-[var(--radius-sm)]">
              You've used all your Spark credits for this cycle.
            </div>
          )}

          <div>
            <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Type</label>
            <div className="flex gap-2">
              {(['spark', 'beacon'] as CreditType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t, recipientId: '' })}
                  className={`chip ${form.type === t ? 'is-selected' : ''}`}
                >
                  {t === 'spark' ? 'Spark award' : 'Beacon nomination'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="ds-label-m text-[var(--foreground)] block mb-1.5">Select Team Member</label>
            <select
              className="ds-input disabled:opacity-50"
              value={form.recipientId}
              onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
              disabled={blocked}
            >
              <option value="">— Choose a team member —</option>
              {manager.reportees.map((r) => (
                <option key={r.id} value={r.id} disabled={givenThisType.has(r.id)}>
                  {r.name} · {r.designation}{givenThisType.has(r.id) ? ` (already ${CREDIT_TYPE_VERB[form.type].toLowerCase()})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-filled btn-lg disabled:opacity-40 disabled:pointer-events-none"
            disabled={submitting || !form.recipientId || blocked || givenThisType.has(form.recipientId)}
            onClick={submit}
          >
            {submitting ? 'Saving…' : form.type === 'spark' ? 'Give Spark Award — uses 1 credit →' : 'Nominate for Beacon →'}
          </button>
        </div>
      </div>

      {myCurrentAwards.length > 0 && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="ds-title-m">My Activity — {currentCycle.label}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] ds-label-m uppercase">
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Recipient</th>
                <th className="text-right px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {[...myCurrentAwards].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                  <td className="px-5 py-3"><TypeTag type={a.type} /></td>
                  <td className="px-5 py-3 font-medium">{a.recipientName}</td>
                  <td className="px-5 py-3 text-right ds-tabular text-xs text-[var(--muted-foreground)]">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HistoryTable
        awards={awards.filter((a) => a.cycleId !== currentCycle.cycleId)}
        title="Previous Cycle Activity — Reference"
        currentCycleLabel={currentCycle.label}
      />
    </div>
  )
}

// ─── Shell ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    loading,
    user,
    role,
    managerId,
    blockedMessage,
    needsVerification,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    resendVerificationEmail,
    recheckVerification,
    signOut,
  } = useAuth()
  const [adminTab, setAdminTab] = useState<'dashboard' | 'people'>('dashboard')

  const [managers, setManagers] = useState<Manager[]>([])
  const [myManager, setMyManager] = useState<Manager | null>(null)
  const [reportees, setReportees] = useState<Reportee[]>([])
  const [awards, setAwards] = useState<Award[]>([])
  const [currentCycle, setCurrentCycle] = useState<CurrentCycle | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])

  const isAdmin = role === 'admin'

  useEffect(() => {
    if (!user || !role) return
    // A manager's managerId claim resolves together with role, but guard the
    // gap anyway rather than passing null into a Firestore doc/query path.
    if (!isAdmin && !managerId) return
    const unsubs = [
      isAdmin ? subscribeManagers(setManagers) : subscribeManager(managerId as string, (m) => setMyManager(m)),
      isAdmin
        ? subscribeReportees({ all: true }, setReportees)
        : subscribeReportees({ managerId: managerId as string }, setReportees),
      isAdmin ? subscribeAwards({ all: true }, setAwards) : subscribeAwards({ managerId: managerId as string }, setAwards),
      subscribeCurrentCycle(setCurrentCycle),
      subscribeCycles(setCycles),
    ]
    return () => unsubs.forEach((u) => u())
  }, [user, role, managerId, isAdmin])

  useEffect(() => {
    if (!currentCycle || !role) return
    if (!isAdmin && !managerId) return
    return isAdmin
      ? subscribeAllocations(currentCycle.cycleId, { all: true }, setAllocations)
      : subscribeAllocations(currentCycle.cycleId, { managerId: managerId as string }, setAllocations)
  }, [currentCycle?.cycleId, isAdmin, managerId, role])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--muted-foreground)]">Loading…</div>
  }
  if (blockedMessage) {
    return <BlockedScreen message={blockedMessage} onRetry={signInWithGoogle} />
  }
  if (needsVerification && user?.email) {
    return (
      <VerifyEmailScreen
        email={user.email}
        onResend={resendVerificationEmail}
        onRecheck={recheckVerification}
        onSignOut={signOut}
      />
    )
  }
  if (!user || !role) {
    return (
      <SignInScreen
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
        onResetPassword={resetPassword}
      />
    )
  }

  const cycleLabelById = new Map(cycles.map((c) => [c.id, c.label]))
  const allocationByManagerId = new Map(allocations.map((a) => [a.managerId, a]))
  const reporteesByManagerId = new Map<string, Reportee[]>()
  for (const r of reportees) {
    reporteesByManagerId.set(r.managerId, [...(reporteesByManagerId.get(r.managerId) ?? []), r])
  }
  const awardsWithLabel: AwardWithLabel[] = awards.map((a) => ({
    ...a,
    cycleLabel: cycleLabelById.get(a.cycleId) ?? a.cycleId,
  }))

  const managersWithData: ManagerWithData[] = managers.map((m) => {
    const alloc = allocationByManagerId.get(m.id)
    return {
      ...m,
      sparkTotal: alloc?.sparkTotal ?? 0,
      beaconTotal: alloc?.beaconTotal ?? 0,
      hasReported: !!alloc,
      reportees: reporteesByManagerId.get(m.id) ?? [],
      currentCycleId: currentCycle?.cycleId,
    }
  })

  const myAlloc = allocations[0]
  const currentManager: ManagerWithData | null =
    !isAdmin && myManager
      ? {
          ...myManager,
          sparkTotal: myAlloc?.sparkTotal ?? 0,
          beaconTotal: myAlloc?.beaconTotal ?? 0,
          hasReported: !!myAlloc,
          reportees: reporteesByManagerId.get(myManager.id) ?? [],
        }
      : null

  async function handleGiveAward(type: CreditType, recipientId: string, recipientName: string) {
    if (!currentManager || !currentCycle) return
    await giveAward({
      cycleId: currentCycle.cycleId,
      managerId: currentManager.id,
      managerName: currentManager.name,
      type,
      recipientId,
      recipientName,
      date: new Date().toISOString().split('T')[0],
    })
  }

  async function handleSetCredits(spark: number, beacon: number) {
    if (!currentManager || !currentCycle) return
    await setMyAllocation(currentCycle.cycleId, currentManager.id, spark, beacon)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header
        className="sticky top-0 z-10 border-b border-[var(--border)]"
        style={{ background: 'var(--surface-app-header)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between" style={{ height: 56 }}>
          <div className="flex items-center gap-3">
            <div className="rounded-[var(--radius-sm)] bg-[var(--primary)] flex items-center justify-center" style={{ width: 28, height: 28 }}>
              <span className="text-white ds-label-m">R</span>
            </div>
            <span className="ds-title-m text-[var(--foreground)]">Rewards & Recognition</span>
            {currentCycle && <span className="tag tag-neutral ds-tabular ml-1">{currentCycle.label}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="ds-body-s text-[var(--muted-foreground)]">{user.displayName ?? user.email} ({isAdmin ? 'Admin' : 'Manager'})</span>
            <button onClick={signOut} className="btn btn-text btn-sm">Sign out</button>
          </div>
        </div>
      </header>

      {isAdmin && (
        <div className="bg-[var(--card)]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="ds-tabs">
              {(['dashboard', 'people'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab)}
                  className={`ds-tab ${adminTab === tab ? 'is-active' : ''}`}
                >
                  {tab === 'dashboard' ? 'Overview' : 'People & Structure'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isAdmin ? (
          adminTab === 'dashboard' ? (
            currentCycle ? (
              <AdminDashboard managers={managersWithData} awards={awardsWithLabel} currentCycleLabel={currentCycle.label} />
            ) : (
              <div className="ds-card p-8 text-center space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  No award cycle is open yet. Add your managers under People &amp; Structure first, then open the first cycle here.
                </p>
                <div className="flex justify-center">
                  <OpenCycleButton />
                </div>
              </div>
            )
          ) : (
            <AdminPeopleView managers={managersWithData} />
          )
        ) : !currentCycle ? (
          <p className="text-sm text-[var(--muted-foreground)]">No award cycle is open yet. Check back once your admin opens one.</p>
        ) : currentManager ? (
          <ManagerView manager={currentManager} awards={awardsWithLabel} currentCycle={currentCycle} onGiveAward={handleGiveAward} onSetCredits={handleSetCredits} />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Loading your data…</p>
        )}
      </main>
    </div>
  )
}
