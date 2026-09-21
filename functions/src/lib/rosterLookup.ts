import { getFirestore } from 'firebase-admin/firestore'

export type RosterMatch =
  | { role: 'admin'; managerId: null }
  | { role: 'manager'; managerId: string }
  | null

/**
 * Resolves a signed-in email to a role + managerId.
 * Reportee-only emails intentionally return null — reportees do not get
 * sign-in access (see docs/plans/2026-09-21-1229-feat-firebase-foundation-plan.md, Scope Boundaries).
 */
export async function rosterLookup(email: string): Promise<RosterMatch> {
  const db = getFirestore()
  const normalizedEmail = email.trim().toLowerCase()

  const adminSnap = await db
    .collection('admins')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get()
  if (!adminSnap.empty) {
    return { role: 'admin', managerId: null }
  }

  const managerSnap = await db
    .collection('managers')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get()
  if (!managerSnap.empty) {
    return { role: 'manager', managerId: managerSnap.docs[0].id }
  }

  return null
}
