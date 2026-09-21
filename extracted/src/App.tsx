import { useState } from 'react'

type Role = 'admin' | 'manager'

interface Reportee {
  id: string
  name: string
  designation: string
}

interface Manager {
  id: string
  name: string
  designation: string
  credits: number          // total credits allocated (editable by admin)
  reportees: Reportee[]
}

interface Award {
  id: string
  managerId: string
  managerName: string
  recipientId: string
  recipientName: string
  reason: string
  category: string
  date: string
  cycleLabel: string       // e.g. "Sep 2026", "Aug 2026"
}

const AWARD_CATEGORIES = ['Star Performer', 'Team Player', 'Innovation', 'Client Excellence', 'Above & Beyond']
const CURRENT_CYCLE = 'Sep 2026'

function calcDefaultCredits(reporteeCount: number) {
  return Math.floor(reporteeCount * 0.4)
}

const initialManagers: Manager[] = [
  {
    id: 'm1',
    name: 'Ashruti Sharma',
    designation: 'Engineering Manager',
    credits: calcDefaultCredits(10), // 4
    reportees: [
      { id: 'r1', name: 'Sanket Patil', designation: 'Senior Engineer' },
      { id: 'r2', name: 'Sarvesh Koyande', designation: 'Engineer' },
      { id: 'r3', name: 'Priya Nair', designation: 'Engineer' },
      { id: 'r4', name: 'Devika Rao', designation: 'Engineer' },
      { id: 'r5', name: 'Aman Trivedi', designation: 'Lead Engineer' },
    ],
  },
  {
    id: 'm2',
    name: 'Shashwat Mehta',
    designation: 'Product Manager',
    credits: calcDefaultCredits(8), // 3
    reportees: [
      { id: 'r6', name: 'Tanvi Kapoor', designation: 'Product Analyst' },
      { id: 'r7', name: 'Rohan Gupta', designation: 'Business Analyst' },
      { id: 'r8', name: 'Meera Joshi', designation: 'Associate PM' },
    ],
  },
  {
    id: 'm3',
    name: 'Suruchi Agarwal',
    designation: 'Design Lead',
    credits: calcDefaultCredits(5), // 2
    reportees: [
      { id: 'r9', name: 'Ananya Singh', designation: 'UI Designer' },
      { id: 'r10', name: 'Karthik Rao', designation: 'UX Researcher' },
    ],
  },
]

const initialAwards: Award[] = [
  // Current cycle
  {
    id: 'a1', managerId: 'm1', managerName: 'Ashruti Sharma',
    recipientId: 'r1', recipientName: 'Sanket Patil',
    reason: 'Led the architecture revamp with zero downtime',
    category: 'Innovation', date: '2026-09-18', cycleLabel: CURRENT_CYCLE,
  },
  {
    id: 'a2', managerId: 'm2', managerName: 'Shashwat Mehta',
    recipientId: 'r6', recipientName: 'Tanvi Kapoor',
    reason: 'Exceptional delivery on the Q3 roadmap planning',
    category: 'Star Performer', date: '2026-09-10', cycleLabel: CURRENT_CYCLE,
  },
  // Previous cycles
  {
    id: 'a3', managerId: 'm1', managerName: 'Ashruti Sharma',
    recipientId: 'r2', recipientName: 'Sarvesh Koyande',
    reason: 'Consistently supported teammates during sprint crunch',
    category: 'Team Player', date: '2026-08-20', cycleLabel: 'Aug 2026',
  },
  {
    id: 'a4', managerId: 'm3', managerName: 'Suruchi Agarwal',
    recipientId: 'r9', recipientName: 'Ananya Singh',
    reason: 'Delivered the design system components ahead of schedule',
    category: 'Above & Beyond', date: '2026-08-14', cycleLabel: 'Aug 2026',
  },
  {
    id: 'a5', managerId: 'm2', managerName: 'Shashwat Mehta',
    recipientId: 'r7', recipientName: 'Rohan Gupta',
    reason: 'Outstanding client engagement during product review',
    category: 'Client Excellence', date: '2026-07-22', cycleLabel: 'Jul 2026',
  },
]

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
      {label}
    </span>
  )
}

function CycleBadge({ label }: { label: string }) {
  const isCurrent = label === CURRENT_CYCLE
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${isCurrent ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>
      {label}
    </span>
  )
}

// ─── Credit Pip display ────────────────────────────────────────────────────────
function CreditPips({ total, used }: { total: number; used: number }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            i < used
              ? 'bg-[var(--primary)] border-[var(--primary)]'
              : 'bg-transparent border-[var(--border)]'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Admin: Overview ──────────────────────────────────────────────────────────
function AdminDashboard({ managers, awards }: { managers: Manager[]; awards: Award[] }) {
  const currentAwards = awards.filter((a) => a.cycleLabel === CURRENT_CYCLE)
  const totalCredits = managers.reduce((s, m) => s + m.credits, 0)
  const totalUsed = managers.reduce((s, m) => {
    return s + currentAwards.filter((a) => a.managerId === m.id).length
  }, 0)

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Credits This Cycle', value: totalCredits, sub: `across ${managers.length} managers` },
          { label: 'Credits Used', value: totalUsed, sub: `${totalCredits - totalUsed} remaining` },
          { label: 'Awards Given', value: currentAwards.length, sub: CURRENT_CYCLE },
        ].map((k) => (
          <div key={k.label} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest mb-1">{k.label}</p>
            <p className="font-serif text-4xl font-semibold text-[var(--foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Manager credit table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-lg font-semibold">Credit Utilisation — {CURRENT_CYCLE}</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">1 credit = 1 award · Credits = 40% of reportee headcount</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Manager</th>
              <th className="text-left px-5 py-3 font-medium">Reportees</th>
              <th className="text-center px-5 py-3 font-medium">Total Credits</th>
              <th className="text-center px-5 py-3 font-medium">Used</th>
              <th className="text-center px-5 py-3 font-medium">Remaining</th>
              <th className="text-left px-5 py-3 font-medium">Visual</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((m, i) => {
              const used = currentAwards.filter((a) => a.managerId === m.id).length
              const remaining = m.credits - used
              return (
                <tr key={m.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{m.designation}</p>
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-foreground)] font-mono text-sm text-left">{m.reportees.length}</td>
                  <td className="px-5 py-4 text-center font-mono font-semibold">{m.credits}</td>
                  <td className="px-5 py-4 text-center font-mono text-[var(--primary)] font-semibold">{used}</td>
                  <td className="px-5 py-4 text-center font-mono text-emerald-700 font-semibold">{remaining}</td>
                  <td className="px-5 py-4">
                    <CreditPips total={m.credits} used={used} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Who was awarded this cycle */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-lg font-semibold">Awards Given — {CURRENT_CYCLE}</h2>
        </div>
        {currentAwards.length === 0 ? (
          <p className="px-5 py-10 text-sm text-[var(--muted-foreground)] text-center">No awards given yet this cycle.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Recipient</th>
                <th className="text-left px-5 py-3 font-medium">Awarded by</th>
                <th className="text-left px-5 py-3 font-medium">Category</th>
                <th className="text-left px-5 py-3 font-medium">Reason</th>
                <th className="text-right px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {[...currentAwards].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                  <td className="px-5 py-3 font-medium">{a.recipientName}</td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{a.managerName}</td>
                  <td className="px-5 py-3"><Badge label={a.category} /></td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)] max-w-xs truncate">{a.reason}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-[var(--muted-foreground)]">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historical awards */}
      <HistoryTable awards={awards.filter((a) => a.cycleLabel !== CURRENT_CYCLE)} title="Past Awards — Previous Cycles" />
    </div>
  )
}

// ─── Admin: People ────────────────────────────────────────────────────────────
function AdminPeopleView({
  managers,
  onUpdateCredits,
  onAddManager,
  onAddReportee,
  onRemoveReportee,
}: {
  managers: Manager[]
  onUpdateCredits: (managerId: string, credits: number) => void
  onAddManager: (name: string, designation: string) => void
  onAddReportee: (managerId: string, name: string, designation: string) => void
  onRemoveReportee: (managerId: string, reporteeId: string) => void
}) {
  const [editingCredits, setEditingCredits] = useState<{ id: string; value: string } | null>(null)
  const [addManager, setAddManager] = useState(false)
  const [newManager, setNewManager] = useState({ name: '', designation: '' })
  const [addReportee, setAddReportee] = useState<string | null>(null)
  const [newReportee, setNewReportee] = useState({ name: '', designation: '' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">People & Structure</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Manage managers, reportees, and credit allocations. Credits auto-calculate at 40% of headcount.</p>
        </div>
        <button
          onClick={() => setAddManager(true)}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          + Add Manager
        </button>
      </div>

      {addManager && (
        <div className="bg-[var(--card)] border border-[var(--primary)] rounded-lg p-5">
          <h3 className="font-medium mb-3 text-sm">New Manager</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              autoFocus
              className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              placeholder="Full name"
              value={newManager.name}
              onChange={(e) => setNewManager({ ...newManager, name: e.target.value })}
            />
            <input
              className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              placeholder="Designation"
              value={newManager.designation}
              onChange={(e) => setNewManager({ ...newManager, designation: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm rounded hover:opacity-90 transition-opacity"
              onClick={() => {
                if (newManager.name.trim()) {
                  onAddManager(newManager.name.trim(), newManager.designation.trim())
                  setNewManager({ name: '', designation: '' })
                  setAddManager(false)
                }
              }}
            >Add</button>
            <button className="px-4 py-2 border border-[var(--border)] text-sm rounded hover:bg-[var(--secondary)] transition-colors" onClick={() => setAddManager(false)}>Cancel</button>
          </div>
        </div>
      )}

      {managers.map((m) => (
        <div key={m.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--secondary)]/40">
            <div>
              <p className="font-semibold">{m.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{m.designation} · {m.reportees.length} reportees</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Credits Allocated</p>
                {editingCredits?.id === m.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="number"
                      className="border border-[var(--border)] rounded px-2 py-1 text-sm font-mono w-16 text-center bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      value={editingCredits.value}
                      onChange={(e) => setEditingCredits({ ...editingCredits, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseInt(editingCredits.value)
                          if (!isNaN(v) && v >= 0) onUpdateCredits(m.id, v)
                          setEditingCredits(null)
                        }
                        if (e.key === 'Escape') setEditingCredits(null)
                      }}
                    />
                    <button className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded" onClick={() => {
                      const v = parseInt(editingCredits.value)
                      if (!isNaN(v) && v >= 0) onUpdateCredits(m.id, v)
                      setEditingCredits(null)
                    }}>Save</button>
                    <button className="text-xs px-2 py-1 border border-[var(--border)] rounded" onClick={() => setEditingCredits(null)}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{m.credits}</span>
                    <button
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                      onClick={() => setEditingCredits({ id: m.id, value: m.credits.toString() })}
                    >✎</button>
                    <button
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors border border-[var(--border)] px-1.5 py-0.5 rounded"
                      onClick={() => onUpdateCredits(m.id, calcDefaultCredits(m.reportees.length))}
                      title="Reset to 40% of headcount"
                    >↺ auto</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                <th className="text-left px-5 py-2.5 font-medium">Reportee</th>
                <th className="text-left px-5 py-2.5 font-medium">Designation</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {m.reportees.map((r, i) => (
                <tr key={r.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/20' : ''}`}>
                  <td className="px-5 py-2.5 font-medium">{r.name}</td>
                  <td className="px-5 py-2.5 text-[var(--muted-foreground)]">{r.designation}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button className="text-xs text-red-400 hover:text-red-600 transition-colors" onClick={() => onRemoveReportee(m.id, r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {addReportee === m.id ? (
                <tr className="border-t border-[var(--border)] bg-amber-50/50">
                  <td className="px-5 py-2.5">
                    <input autoFocus className="border border-[var(--border)] rounded px-2 py-1 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" placeholder="Full name" value={newReportee.name} onChange={(e) => setNewReportee({ ...newReportee, name: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5">
                    <input className="border border-[var(--border)] rounded px-2 py-1 text-sm w-full bg-white focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" placeholder="Designation" value={newReportee.designation} onChange={(e) => setNewReportee({ ...newReportee, designation: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded" onClick={() => {
                        if (newReportee.name.trim()) {
                          onAddReportee(m.id, newReportee.name.trim(), newReportee.designation.trim())
                          setNewReportee({ name: '', designation: '' })
                          setAddReportee(null)
                        }
                      }}>Add</button>
                      <button className="text-xs px-2 py-1 border border-[var(--border)] rounded hover:bg-[var(--secondary)] transition-colors" onClick={() => { setAddReportee(null); setNewReportee({ name: '', designation: '' }) }}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={3} className="px-5 py-2">
                    <button className="text-xs text-[var(--primary)] hover:underline" onClick={() => setAddReportee(m.id)}>+ Add reportee</button>
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

// ─── History table (shared) ───────────────────────────────────────────────────
function HistoryTable({ awards, title }: { awards: Award[]; title: string }) {
  if (awards.length === 0) return null
  const grouped = awards.reduce<Record<string, Award[]>>((acc, a) => {
    ;(acc[a.cycleLabel] = acc[a.cycleLabel] || []).push(a)
    return acc
  }, {})

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Reference this to avoid repeating the same recognition</p>
      </div>
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([cycle, cycleAwards]) => (
          <div key={cycle}>
            <div className="px-5 py-2 bg-[var(--secondary)]/60 border-t border-[var(--border)] flex items-center gap-2">
              <CycleBadge label={cycle} />
              <span className="text-xs text-[var(--muted-foreground)]">{cycleAwards.length} award{cycleAwards.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {cycleAwards.map((a, i) => (
                  <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/20' : ''}`}>
                    <td className="px-5 py-3 font-medium w-40">{a.recipientName}</td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)] text-xs w-36">{a.managerName}</td>
                    <td className="px-5 py-3"><Badge label={a.category} /></td>
                    <td className="px-5 py-3 text-[var(--muted-foreground)]">{a.reason}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-[var(--muted-foreground)] whitespace-nowrap">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  )
}

// ─── Manager View ─────────────────────────────────────────────────────────────
function ManagerView({
  manager,
  awards,
  onGiveAward,
}: {
  manager: Manager
  awards: Award[]
  onGiveAward: (managerId: string, recipientId: string, recipientName: string, reason: string, category: string) => void
}) {
  const myCurrentAwards = awards.filter((a) => a.managerId === manager.id && a.cycleLabel === CURRENT_CYCLE)
  const used = myCurrentAwards.length
  const remaining = manager.credits - used

  // Who has already been awarded this cycle by this manager
  const awardedThisCycle = new Set(myCurrentAwards.map((a) => a.recipientId))

  const [form, setForm] = useState({ recipientId: '', reason: '', category: AWARD_CATEGORIES[0] })
  const [success, setSuccess] = useState<string | null>(null)

  function submit() {
    const rep = manager.reportees.find((r) => r.id === form.recipientId)
    if (!rep || !form.reason.trim() || remaining <= 0) return
    onGiveAward(manager.id, rep.id, rep.name, form.reason, form.category)
    setForm({ recipientId: '', reason: '', category: AWARD_CATEGORIES[0] })
    setSuccess(rep.name)
    setTimeout(() => setSuccess(null), 4000)
  }

  const allMyAwards = awards.filter((a) => a.managerId === manager.id)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Credit status card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest mb-1">Your Credits — {CURRENT_CYCLE}</p>
            <div className="flex items-baseline gap-2">
              <p className="font-serif text-5xl font-semibold text-[var(--foreground)]">{remaining}</p>
              <p className="text-[var(--muted-foreground)] text-sm">/ {manager.credits} remaining</p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{used} credit{used !== 1 ? 's' : ''} used · 1 credit = 1 award</p>
          </div>
        </div>
        <CreditPips total={manager.credits} used={used} />
      </div>

      {/* Award form */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-lg font-semibold">Give a Recognition Award</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Uses 1 credit · Each team member can receive 1 award per cycle</p>
        </div>
        <div className="p-5 space-y-4">
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-md flex items-center gap-2">
              <span>🏆</span> Award given to <strong>{success}</strong> — {remaining} credit{remaining !== 1 ? 's' : ''} remaining
            </div>
          )}
          {remaining === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-md">
              You've used all your credits for this cycle.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Select Team Member</label>
            <select
              className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-50"
              value={form.recipientId}
              onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
              disabled={remaining === 0}
            >
              <option value="">— Choose a team member —</option>
              {manager.reportees.map((r) => (
                <option key={r.id} value={r.id} disabled={awardedThisCycle.has(r.id)}>
                  {r.name} · {r.designation}{awardedThisCycle.has(r.id) ? ' (already awarded)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {AWARD_CATEGORIES.map((c) => (
                <button
                  key={c}
                  disabled={remaining === 0}
                  onClick={() => setForm({ ...form, category: c })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-40 ${
                    form.category === c
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Reason for Recognition</label>
            <textarea
              className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none disabled:opacity-50"
              rows={3}
              placeholder="Describe what this person did that deserves recognition..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              disabled={remaining === 0}
            />
          </div>

          <button
            className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!form.recipientId || !form.reason.trim() || remaining === 0 || awardedThisCycle.has(form.recipientId)}
            onClick={submit}
          >
            Give Award — uses 1 credit →
          </button>
        </div>
      </div>

      {/* Current cycle history */}
      {myCurrentAwards.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-serif text-lg font-semibold">My Awards — {CURRENT_CYCLE}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--secondary)] text-[var(--muted-foreground)] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Recipient</th>
                <th className="text-left px-5 py-3 font-medium">Category</th>
                <th className="text-left px-5 py-3 font-medium">Reason</th>
                <th className="text-right px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {[...myCurrentAwards].sort((a, b) => b.date.localeCompare(a.date)).map((a, i) => (
                <tr key={a.id} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--secondary)]/30' : ''}`}>
                  <td className="px-5 py-3 font-medium">{a.recipientName}</td>
                  <td className="px-5 py-3"><Badge label={a.category} /></td>
                  <td className="px-5 py-3 text-[var(--muted-foreground)]">{a.reason}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-[var(--muted-foreground)]">{a.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Past cycles reference */}
      <HistoryTable
        awards={allMyAwards.filter((a) => a.cycleLabel !== CURRENT_CYCLE)}
        title="Previous Cycle Awards — Reference"
      />
    </div>
  )
}

// ─── Shell ─────────────────────────────────────────────────────────────────────
const ADMIN_USERS = [
  { id: 'admin1', name: 'Jinan Muneer', role: 'admin' as Role, initials: 'JM' },
  { id: 'admin2', name: 'Swethali', role: 'admin' as Role, initials: 'SW' },
  { id: 'admin3', name: 'Rajeev', role: 'admin' as Role, initials: 'RK' },
]

const MANAGER_USERS = [
  { id: 'm1', name: 'Ashruti Sharma', role: 'manager' as Role, initials: 'AS' },
  { id: 'm2', name: 'Shashwat Mehta', role: 'manager' as Role, initials: 'SM' },
  { id: 'm3', name: 'Suruchi Agarwal', role: 'manager' as Role, initials: 'SU' },
]

const ALL_USERS = [...ADMIN_USERS, ...MANAGER_USERS]

export default function App() {
  const [currentUser, setCurrentUser] = useState(ALL_USERS[0])
  const [adminTab, setAdminTab] = useState<'dashboard' | 'people'>('dashboard')
  const [managers, setManagers] = useState<Manager[]>(initialManagers)
  const [awards, setAwards] = useState<Award[]>(initialAwards)

  function updateCredits(managerId: string, credits: number) {
    setManagers((ms) => ms.map((m) => m.id === managerId ? { ...m, credits } : m))
  }

  function addManager(name: string, designation: string) {
    setManagers((ms) => [...ms, { id: `m${Date.now()}`, name, designation, credits: 0, reportees: [] }])
  }

  function addReportee(managerId: string, name: string, designation: string) {
    setManagers((ms) =>
      ms.map((m) =>
        m.id === managerId
          ? { ...m, reportees: [...m.reportees, { id: `r${Date.now()}`, name, designation }] }
          : m
      )
    )
  }

  function removeReportee(managerId: string, reporteeId: string) {
    setManagers((ms) =>
      ms.map((m) =>
        m.id === managerId ? { ...m, reportees: m.reportees.filter((r) => r.id !== reporteeId) } : m
      )
    )
  }

  function giveAward(managerId: string, recipientId: string, recipientName: string, reason: string, category: string) {
    const mgr = managers.find((m) => m.id === managerId)!
    setAwards((as) => [
      ...as,
      {
        id: `a${Date.now()}`,
        managerId,
        managerName: mgr.name,
        recipientId,
        recipientName,
        reason,
        category,
        date: new Date().toISOString().split('T')[0],
        cycleLabel: CURRENT_CYCLE,
      },
    ])
  }

  const isAdmin = currentUser.role === 'admin'
  const currentManager = isAdmin ? null : managers.find((m) => m.id === currentUser.id) ?? null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <span className="font-serif font-semibold text-[var(--foreground)]">Rewards & Recognition</span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono ml-1">{CURRENT_CYCLE}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">Viewing as:</span>
            <select
              className="border border-[var(--border)] rounded px-3 py-1.5 text-sm bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              value={currentUser.id}
              onChange={(e) => {
                const u = ALL_USERS.find((u) => u.id === e.target.value)!
                setCurrentUser(u)
                setAdminTab('dashboard')
              }}
            >
              <optgroup label="Admins">
                {ADMIN_USERS.map((u) => <option key={u.id} value={u.id}>{u.name} (Admin)</option>)}
              </optgroup>
              <optgroup label="Managers">
                {MANAGER_USERS.map((u) => <option key={u.id} value={u.id}>{u.name} (Manager)</option>)}
              </optgroup>
            </select>
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{currentUser.initials}</span>
            </div>
          </div>
        </div>
      </header>

      {isAdmin && (
        <div className="border-b border-[var(--border)] bg-[var(--card)]">
          <div className="max-w-5xl mx-auto px-6 flex">
            {(['dashboard', 'people'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAdminTab(tab)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === tab
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {tab === 'dashboard' ? 'Overview' : 'People & Structure'}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isAdmin ? (
          adminTab === 'dashboard' ? (
            <AdminDashboard managers={managers} awards={awards} />
          ) : (
            <AdminPeopleView
              managers={managers}
              onUpdateCredits={updateCredits}
              onAddManager={addManager}
              onAddReportee={addReportee}
              onRemoveReportee={removeReportee}
            />
          )
        ) : currentManager ? (
          <ManagerView manager={currentManager} awards={awards} onGiveAward={giveAward} />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Manager not found.</p>
        )}
      </main>
    </div>
  )
}
