import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { SignInScreen } from './components/SignInScreen'
import { BlockedScreen } from './components/BlockedScreen'
import { RosterImport } from './components/RosterImport'
import { OpenCycleButton } from './components/OpenCycleButton'
import {
  addManager as createManager,
  addReportee as createReportee,
  giveAward,
  removeReportee,
  resetAllocation,
  setAllocation,
  subscribeAllocations,
  subscribeAwards,
  subscribeCurrentCycle,
  subscribeCycles,
  subscribeManager,
  subscribeManagers,
  subscribeReportees,
  type Allocation,
  type Award,
  type CurrentCycle,
  type Cycle,
  type Manager,
  type Reportee,
} from './lib/firestore'

const AWARD_CATEGORIES = ['Star Performer', 'Team Player', 'Innovation', 'Client Excellence', 'Above & Beyond']

// A manager combined with this cycle's data, matching the shape the
// dashboard/people/manager views render against.
interface ManagerWithData extends Manager {
  credits: number
  reportees: Reportee[]
  currentCycleId?: string
}

interface AwardWithLabel extends Award {
  cycleLabel: string
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-light-background)] text-[var(--primary)]">
      {label}
    </span>
  )
}

function CycleBadge({ label, isCurrent }: { label: string; isCurrent: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${isCurrent ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}>
      {label}
    </span>
  )
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
  const totalCredits = managers.reduce((s, m) => s + m.credits, 0)
  const totalUsed = managers.reduce((s, m) => s + currentAwards.filter((a) => a.managerId === m.id).length, 0)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Credits This Cycle', value: totalCredits, sub: `across ${managers.length} managers` },
          { label: 'Credits Used', value: totalUsed, sub: `${totalCredits - totalUsed} remaining` },
          { label: 'Awards Given', value: currentAwards.length, sub: currentCycleLabel },
        ].map((k) => (
          <div key={k.label} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest mb-1">{k.label}</p>
            <p className="font-serif text-4xl font-semibold text-[var(--foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold">Credit Utilisation — {currentCycleLabel}</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">1 credit = 1 award · Credits = 40% of reportee headcount</p>
          </div>
          <OpenCycleButton />
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
                  <td className="px-5 py-4 text-center font-mono text-[var(--success-foreground)] font-semibold">{remaining}</td>
                  <td className="px-5 py-4">
                    <CreditPips total={m.credits} used={used} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-lg font-semibold">Awards Given — {currentCycleLabel}</h2>
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

      <HistoryTable
        awards={awards.filter((a) => a.cycleLabel !== currentCycleLabel)}
        title="Past Awards — Previous Cycles"
        currentCycleLabel={currentCycleLabel}
      />
    </div>
  )
}

// ─── Admin: People ────────────────────────────────────────────────────────────
function AdminPeopleView({ managers }: { managers: ManagerWithData[] }) {
  const [editingCredits, setEditingCredits] = useState<{ id: string; value: string } | null>(null)
  const [addManager, setAddManager] = useState(false)
  const [newManager, setNewManager] = useState({ name: '', designation: '', email: '' })
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

      <RosterImport />

      {addManager && (
        <div className="bg-[var(--card)] border border-[var(--primary)] rounded-lg p-5">
          <h3 className="font-medium mb-3 text-sm">New Manager</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input autoFocus className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)]" placeholder="Full name" value={newManager.name} onChange={(e) => setNewManager({ ...newManager, name: e.target.value })} />
            <input className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)]" placeholder="Google email" value={newManager.email} onChange={(e) => setNewManager({ ...newManager, email: e.target.value })} />
            <input className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)]" placeholder="Designation" value={newManager.designation} onChange={(e) => setNewManager({ ...newManager, designation: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm rounded hover:opacity-90 transition-opacity"
              onClick={async () => {
                if (newManager.name.trim() && newManager.email.trim()) {
                  await createManager(newManager.email, newManager.name, newManager.designation)
                  setNewManager({ name: '', designation: '', email: '' })
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
                <p className="text-xs text-[var(--muted-foreground)] mb-1">Credits Allocated (this cycle)</p>
                {editingCredits?.id === m.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="number"
                      className="border border-[var(--border)] rounded px-2 py-1 text-sm font-mono w-16 text-center bg-[var(--background)]"
                      value={editingCredits.value}
                      onChange={(e) => setEditingCredits({ ...editingCredits, value: e.target.value })}
                    />
                    <button
                      className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded"
                      onClick={async () => {
                        const v = parseInt(editingCredits.value)
                        if (!isNaN(v) && v >= 0 && m.currentCycleId) {
                          await setAllocation(m.currentCycleId, m.id, v)
                        }
                        setEditingCredits(null)
                      }}
                    >Save</button>
                    <button className="text-xs px-2 py-1 border border-[var(--border)] rounded" onClick={() => setEditingCredits(null)}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{m.credits}</span>
                    <button className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors" onClick={() => setEditingCredits({ id: m.id, value: m.credits.toString() })}>✎</button>
                    <button
                      className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors border border-[var(--border)] px-1.5 py-0.5 rounded"
                      onClick={() => m.currentCycleId && resetAllocation(m.currentCycleId, m.id)}
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
                    <button className="text-xs text-[var(--error-foreground)] hover:opacity-70 transition-opacity" onClick={() => removeReportee(r.id)}>Remove</button>
                  </td>
                </tr>
              ))}
              {addReportee === m.id ? (
                <tr className="border-t border-[var(--border)] bg-[var(--primary-light-background)]/60">
                  <td className="px-5 py-2.5">
                    <input autoFocus className="border border-[var(--border)] rounded px-2 py-1 text-sm w-full bg-white" placeholder="Full name" value={newReportee.name} onChange={(e) => setNewReportee({ ...newReportee, name: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5">
                    <input className="border border-[var(--border)] rounded px-2 py-1 text-sm w-full bg-white" placeholder="Designation" value={newReportee.designation} onChange={(e) => setNewReportee({ ...newReportee, designation: e.target.value })} />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded"
                        onClick={async () => {
                          if (newReportee.name.trim()) {
                            await createReportee(m.id, newReportee.name, newReportee.designation)
                            setNewReportee({ name: '', designation: '' })
                            setAddReportee(null)
                          }
                        }}
                      >Add</button>
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
function HistoryTable({ awards, title, currentCycleLabel }: { awards: AwardWithLabel[]; title: string; currentCycleLabel: string }) {
  if (awards.length === 0) return null
  const grouped = awards.reduce<Record<string, AwardWithLabel[]>>((acc, a) => {
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
              <CycleBadge label={cycle} isCurrent={cycle === currentCycleLabel} />
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
  currentCycle,
  onGiveAward,
}: {
  manager: ManagerWithData
  awards: AwardWithLabel[]
  currentCycle: CurrentCycle
  onGiveAward: (recipientId: string, recipientName: string, reason: string, category: string) => Promise<void>
}) {
  const myCurrentAwards = awards.filter((a) => a.cycleId === currentCycle.cycleId)
  const used = myCurrentAwards.length
  const remaining = manager.credits - used
  const awardedThisCycle = new Set(myCurrentAwards.map((a) => a.recipientId))

  const [form, setForm] = useState({ recipientId: '', reason: '', category: AWARD_CATEGORIES[0] })
  const [success, setSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const rep = manager.reportees.find((r) => r.id === form.recipientId)
    if (!rep || !form.reason.trim() || remaining <= 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onGiveAward(rep.id, rep.name, form.reason, form.category)
      setForm({ recipientId: '', reason: '', category: AWARD_CATEGORIES[0] })
      setSuccess(rep.name)
      setTimeout(() => setSuccess(null), 4000)
    } catch {
      setSubmitError("Couldn't give this award -- your cycle may be out of date. Refresh and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-widest mb-1">Your Credits — {currentCycle.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="font-serif text-5xl font-semibold text-[var(--foreground)]">{remaining}</p>
              <p className="text-[var(--muted-foreground)] text-sm">/ {manager.credits} remaining</p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{used} credit{used !== 1 ? 's' : ''} used · 1 credit = 1 award</p>
          </div>
        </div>
        <CreditPips total={manager.credits} used={used} />
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-serif text-lg font-semibold">Give a Recognition Award</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Uses 1 credit · Each team member can receive 1 award per cycle</p>
        </div>
        <div className="p-5 space-y-4">
          {success && (
            <div className="bg-[var(--success-light-background)] border border-[var(--success-foreground)]/20 text-[var(--success-foreground)] text-sm px-4 py-3 rounded-md flex items-center gap-2">
              <span>🏆</span> Award given to <strong>{success}</strong> — {remaining} credit{remaining !== 1 ? 's' : ''} remaining
            </div>
          )}
          {submitError && (
            <div className="bg-[var(--error-light-background)] border border-[var(--error-foreground)]/20 text-[var(--error-foreground)] text-sm px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}
          {remaining === 0 && (
            <div className="bg-[var(--warning-light-background)] border border-[var(--warning-foreground)]/20 text-[var(--warning-foreground)] text-sm px-4 py-3 rounded-md">
              You've used all your credits for this cycle.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Select Team Member</label>
            <select
              className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] disabled:opacity-50"
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
                    form.category === c ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Reason for Recognition</label>
            <textarea
              className="w-full border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--background)] resize-none disabled:opacity-50"
              rows={3}
              placeholder="Describe what this person did that deserves recognition..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              disabled={remaining === 0}
            />
          </div>

          <button
            className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={submitting || !form.recipientId || !form.reason.trim() || remaining === 0 || awardedThisCycle.has(form.recipientId)}
            onClick={submit}
          >
            {submitting ? 'Giving award…' : 'Give Award — uses 1 credit →'}
          </button>
        </div>
      </div>

      {myCurrentAwards.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-serif text-lg font-semibold">My Awards — {currentCycle.label}</h2>
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

      <HistoryTable
        awards={awards.filter((a) => a.cycleId !== currentCycle.cycleId)}
        title="Previous Cycle Awards — Reference"
        currentCycleLabel={currentCycle.label}
      />
    </div>
  )
}

// ─── Shell ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { loading, user, role, managerId, blockedMessage, signInWithGoogle, signOut } = useAuth()
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
  if (!user || !role) {
    return <SignInScreen onSignIn={signInWithGoogle} />
  }

  const cycleLabelById = new Map(cycles.map((c) => [c.id, c.label]))
  const allocationByManagerId = new Map(allocations.map((a) => [a.managerId, a.allocated]))
  const reporteesByManagerId = new Map<string, Reportee[]>()
  for (const r of reportees) {
    reporteesByManagerId.set(r.managerId, [...(reporteesByManagerId.get(r.managerId) ?? []), r])
  }
  const awardsWithLabel: AwardWithLabel[] = awards.map((a) => ({
    ...a,
    cycleLabel: cycleLabelById.get(a.cycleId) ?? a.cycleId,
  }))

  const managersWithData: ManagerWithData[] = managers.map((m) => ({
    ...m,
    credits: allocationByManagerId.get(m.id) ?? 0,
    reportees: reporteesByManagerId.get(m.id) ?? [],
    currentCycleId: currentCycle?.cycleId,
  }))

  const currentManager: ManagerWithData | null =
    !isAdmin && myManager
      ? {
          ...myManager,
          credits: allocations[0]?.allocated ?? 0,
          reportees: reporteesByManagerId.get(myManager.id) ?? [],
        }
      : null

  async function handleGiveAward(recipientId: string, recipientName: string, reason: string, category: string) {
    if (!currentManager || !currentCycle) return
    await giveAward({
      cycleId: currentCycle.cycleId,
      managerId: currentManager.id,
      managerName: currentManager.name,
      recipientId,
      recipientName,
      reason,
      category,
      date: new Date().toISOString().split('T')[0],
    })
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <span className="font-serif font-semibold text-[var(--foreground)]">Rewards & Recognition</span>
            {currentCycle && <span className="text-xs text-[var(--muted-foreground)] font-mono ml-1">{currentCycle.label}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">{user.displayName ?? user.email} ({isAdmin ? 'Admin' : 'Manager'})</span>
            <button onClick={signOut} className="text-xs text-[var(--primary)] hover:underline">Sign out</button>
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
                  adminTab === tab ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
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
            currentCycle ? (
              <AdminDashboard managers={managersWithData} awards={awardsWithLabel} currentCycleLabel={currentCycle.label} />
            ) : (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center space-y-3">
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
          <ManagerView manager={currentManager} awards={awardsWithLabel} currentCycle={currentCycle} onGiveAward={handleGiveAward} />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Loading your data…</p>
        )}
      </main>
    </div>
  )
}
