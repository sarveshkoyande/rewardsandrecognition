import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from './firebase'

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

/** The one direct client write this app makes (KTD5): a manager records an award they already gave. */
export async function giveAward(award: Omit<Award, 'id'>): Promise<void> {
  await addDoc(collection(db, 'awards'), award)
}

export const importRosterCall = httpsCallable<
  { rows: Array<{ manager_name: string; manager_email: string; reportee_name: string; reportee_designation: string }> },
  { results: Array<{ row: number; status: string; reason?: string }> }
>(functions, 'importRoster')

export const openCycleCall = httpsCallable<{ label: string }, { cycleId: string; label: string }>(
  functions,
  'openCycle'
)

export const adminEditRosterCall = httpsCallable<Record<string, unknown>, Record<string, unknown>>(
  functions,
  'adminEditRoster'
)
