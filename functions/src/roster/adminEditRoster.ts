import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { calcDefaultCredits } from '../lib/credits'

function requireAdmin(auth: { token?: Record<string, any> } | undefined) {
  if (!auth || auth.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only an admin can edit the roster.')
  }
}

/**
 * resetAllocation/setAllocation only ever apply to the open cycle -- a
 * closed cycle's allocation snapshot is historical and must stay fixed
 * (R7, AE3). Without this check a stale client reference could silently
 * rewrite a past cycle's reported allocation.
 */
async function requireCurrentCycle(db: Firestore, cycleId: string) {
  const metaSnap = await db.doc('meta/currentCycle').get()
  if (!metaSnap.exists || metaSnap.data()?.cycleId !== cycleId) {
    throw new HttpsError('failed-precondition', 'This cycle is closed and can no longer be edited.')
  }
}

type EditAction =
  | { action: 'addManager'; name: string; email: string; designation?: string }
  | { action: 'addReportee'; managerId: string; name: string; designation?: string }
  | { action: 'removeReportee'; reporteeId: string }
  | { action: 'resetAllocation'; cycleId: string; managerId: string }
  | { action: 'setAllocation'; cycleId: string; managerId: string; allocated: number }

/**
 * Covers R5 -- the admin's one-at-a-time manual roster edits, kept on the
 * same read-mostly-client-rules pattern as importRoster/openCycle (KTD5
 * extension noted in the plan's U6).
 */
export const adminEditRoster = onCall<EditAction>(async (request) => {
  requireAdmin(request.auth)
  const db = getFirestore()
  const data = request.data

  switch (data.action) {
    case 'addManager': {
      const name = data.name?.trim()
      const email = data.email?.trim().toLowerCase()
      if (!name || !email) throw new HttpsError('invalid-argument', 'Manager name and email are required.')
      const ref = await db
        .collection('managers')
        .add({ name, email, designation: data.designation?.trim() ?? '' })
      return { managerId: ref.id }
    }
    case 'addReportee': {
      const name = data.name?.trim()
      if (!data.managerId || !name) {
        throw new HttpsError('invalid-argument', 'managerId and reportee name are required.')
      }
      const ref = await db
        .collection('reportees')
        .add({ managerId: data.managerId, name, designation: data.designation?.trim() ?? '' })
      return { reporteeId: ref.id }
    }
    case 'removeReportee': {
      if (!data.reporteeId) throw new HttpsError('invalid-argument', 'reporteeId is required.')
      await db.collection('reportees').doc(data.reporteeId).delete()
      return { removed: data.reporteeId }
    }
    case 'resetAllocation': {
      if (!data.cycleId || !data.managerId) {
        throw new HttpsError('invalid-argument', 'cycleId and managerId are required.')
      }
      await requireCurrentCycle(db, data.cycleId)
      const reporteesSnap = await db
        .collection('reportees')
        .where('managerId', '==', data.managerId)
        .get()
      const allocated = calcDefaultCredits(reporteesSnap.size)
      await db
        .doc(`cycles/${data.cycleId}/allocations/${data.managerId}`)
        .set({ managerId: data.managerId, allocated })
      return { allocated }
    }
    case 'setAllocation': {
      if (!data.cycleId || !data.managerId || typeof data.allocated !== 'number' || data.allocated < 0) {
        throw new HttpsError('invalid-argument', 'cycleId, managerId, and a non-negative allocated value are required.')
      }
      await requireCurrentCycle(db, data.cycleId)
      await db
        .doc(`cycles/${data.cycleId}/allocations/${data.managerId}`)
        .set({ managerId: data.managerId, allocated: data.allocated })
      return { allocated: data.allocated }
    }
    default:
      throw new HttpsError('invalid-argument', 'Unknown action.')
  }
})
