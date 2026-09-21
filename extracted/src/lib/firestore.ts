import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import { calcDefaultCredits } from './credits'

export interface Manager {
  id: string
  name: string
  email: string
  designation: string
}

export interface Reportee {
  id: string
  managerId: string
  name: string
  designation: string
}

export interface Award {
  id: string
  cycleId: string
  managerId: string
  managerName: string
  recipientId: string
  recipientName: string
  reason: string
  category: string
  date: string
}

export interface CurrentCycle {
  cycleId: string
  label: string
}

export interface Cycle {
  id: string
  label: string
  status: 'open' | 'closed'
  openedAt: string
}

export interface Allocation {
  managerId: string
  allocated: number
}

export function subscribeManagers(onChange: (managers: Manager[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'managers'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Manager, 'id'>) })))
  })
}

export function subscribeManager(managerId: string, onChange: (manager: Manager | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'managers', managerId), (snap) => {
    onChange(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<Manager, 'id'>) } : null)
  })
}

export function subscribeReportees(
  scope: { all: true } | { managerId: string },
  onChange: (reportees: Reportee[]) => void
): Unsubscribe {
  const q =
    'all' in scope
      ? collection(db, 'reportees')
      : query(collection(db, 'reportees'), where('managerId', '==', scope.managerId))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reportee, 'id'>) })))
  })
}

export function subscribeAwards(
  scope: { all: true } | { managerId: string },
  onChange: (awards: Award[]) => void
): Unsubscribe {
  const q =
    'all' in scope
      ? collection(db, 'awards')
      : query(collection(db, 'awards'), where('managerId', '==', scope.managerId))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Award, 'id'>) })))
  })
}

export function subscribeCurrentCycle(onChange: (cycle: CurrentCycle | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'meta', 'currentCycle'), (snap) => {
    onChange(snap.exists() ? (snap.data() as CurrentCycle) : null)
  })
}

/** Readable by any signed-in manager or admin (firestore.rules) -- used for cycle-label lookups in history views. */
export function subscribeCycles(onChange: (cycles: Cycle[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'cycles'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cycle, 'id'>) })))
  })
}

/**
 * Admin scope lists the whole allocations collection (rules-permitted for
 * `role == 'admin'`). Manager scope reads only their own allocation doc by
 * id -- a manager has no list permission on the collection, only read on
 * the doc whose id equals their own managerId (firestore.rules).
 */
export function subscribeAllocations(
  cycleId: string,
  scope: { all: true } | { managerId: string },
  onChange: (allocations: Allocation[]) => void
): Unsubscribe {
  if ('all' in scope) {
    return onSnapshot(collection(db, 'cycles', cycleId, 'allocations'), (snap) => {
      onChange(snap.docs.map((d) => d.data() as Allocation))
    })
  }
  return onSnapshot(doc(db, 'cycles', cycleId, 'allocations', scope.managerId), (snap) => {
    onChange(snap.exists() ? [snap.data() as Allocation] : [])
  })
}

/** The one direct client write every signed-in manager makes: recording an award they already gave. */
export async function giveAward(award: Omit<Award, 'id'>): Promise<void> {
  await addDoc(collection(db, 'awards'), award)
}

// ─── Admin roster edits (R5) -- direct client writes, gated by firestore.rules' isAdmin() ──

export async function addManager(email: string, name: string, designation: string): Promise<void> {
  const id = email.trim().toLowerCase()
  await setDoc(doc(db, 'managers', id), { name: name.trim(), email: id, designation: designation.trim() })
}

export async function addReportee(managerId: string, name: string, designation: string): Promise<void> {
  await addDoc(collection(db, 'reportees'), { managerId, name: name.trim(), designation: designation.trim() })
}

export async function removeReportee(reporteeId: string): Promise<void> {
  await deleteDoc(doc(db, 'reportees', reporteeId))
}

export async function resetAllocation(cycleId: string, managerId: string): Promise<number> {
  const reporteesSnap = await getDocs(query(collection(db, 'reportees'), where('managerId', '==', managerId)))
  const allocated = calcDefaultCredits(reporteesSnap.size)
  await setDoc(doc(db, 'cycles', cycleId, 'allocations', managerId), { managerId, allocated })
  return allocated
}

export async function setAllocation(cycleId: string, managerId: string, allocated: number): Promise<void> {
  await setDoc(doc(db, 'cycles', cycleId, 'allocations', managerId), { managerId, allocated })
}

// ─── CSV roster bulk-import (R4, AE1) ──────────────────────────────────────────

export interface RosterRow {
  manager_name: string
  manager_email: string
  reportee_name: string
  reportee_designation: string
}

export type RosterRowResult =
  | { row: number; status: 'created'; managerId: string }
  | { row: number; status: 'skipped'; reason: string }

/**
 * Managers are keyed by email as their Firestore document id, so "upsert by
 * email" (AE1) is just a setDoc to that id -- no query needed, and repeated
 * rows for the same manager in one CSV pass reuse the same doc.
 */
export async function importRoster(rows: RosterRow[]): Promise<RosterRowResult[]> {
  const results: RosterRowResult[] = []
  const seenManagerIds = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const managerName = row.manager_name?.trim()
    const managerEmail = row.manager_email?.trim().toLowerCase()
    const reporteeName = row.reportee_name?.trim()
    const reporteeDesignation = row.reportee_designation?.trim() ?? ''

    if (!managerName || !managerEmail) {
      results.push({ row: i, status: 'skipped', reason: 'Missing manager name or email' })
      continue
    }
    if (!reporteeName) {
      results.push({ row: i, status: 'skipped', reason: 'Missing reportee name' })
      continue
    }

    if (!seenManagerIds.has(managerEmail)) {
      await setDoc(
        doc(db, 'managers', managerEmail),
        { name: managerName, email: managerEmail, designation: '' },
        { merge: true }
      )
      seenManagerIds.add(managerEmail)
    }

    await addDoc(collection(db, 'reportees'), {
      managerId: managerEmail,
      name: reporteeName,
      designation: reporteeDesignation,
    })

    results.push({ row: i, status: 'created', managerId: managerEmail })
  }

  return results
}

// ─── Cycle open (R6, R7, R8, AE3) ──────────────────────────────────────────────

export async function openCycle(label: string): Promise<{ cycleId: string; label: string }> {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('A cycle label is required.')

  const [managersSnap, reporteesSnap, metaSnap] = await Promise.all([
    getDocs(collection(db, 'managers')),
    getDocs(collection(db, 'reportees')),
    getDoc(doc(db, 'meta', 'currentCycle')),
  ])

  const reporteeCounts = new Map<string, number>()
  for (const reporteeDoc of reporteesSnap.docs) {
    const managerId = reporteeDoc.data().managerId as string
    reporteeCounts.set(managerId, (reporteeCounts.get(managerId) ?? 0) + 1)
  }

  const previousCycleId = metaSnap.exists() ? (metaSnap.data().cycleId as string | undefined) : undefined

  const batch = writeBatch(db)
  const newCycleRef = doc(collection(db, 'cycles'))
  batch.set(newCycleRef, { label: trimmed, status: 'open', openedAt: new Date().toISOString() })

  for (const managerDoc of managersSnap.docs) {
    const allocated = calcDefaultCredits(reporteeCounts.get(managerDoc.id) ?? 0)
    // Allocation docs are new here (rules-permitted create), never already
    // existing -- a fresh cycle id can't collide with a prior cycle's
    // allocation subcollection.
    batch.set(doc(db, 'cycles', newCycleRef.id, 'allocations', managerDoc.id), {
      managerId: managerDoc.id,
      allocated,
    })
  }

  if (previousCycleId) {
    batch.update(doc(db, 'cycles', previousCycleId), { status: 'closed' })
  }

  batch.set(doc(db, 'meta', 'currentCycle'), { cycleId: newCycleRef.id, label: trimmed })

  await batch.commit()
  return { cycleId: newCycleRef.id, label: trimmed }
}
