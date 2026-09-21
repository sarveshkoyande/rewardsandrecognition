import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { calcDefaultCredits } from '../lib/credits'

function requireAdmin(auth: { token?: Record<string, any> } | undefined) {
  if (!auth || auth.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only an admin can open a new cycle.')
  }
}

/**
 * Opens a new award cycle (R6): snapshots each manager's credit allocation
 * at 40% of current headcount (R7), closes the previous cycle, and points
 * meta/currentCycle at the new one so no manager's balance carries over
 * unused credit from the closed cycle (R8, AE3).
 */
export const openCycle = onCall<{ label: string }>(async (request) => {
  requireAdmin(request.auth)

  const label = request.data?.label?.trim()
  if (!label) {
    throw new HttpsError('invalid-argument', 'A cycle label is required.')
  }

  const db = getFirestore()

  const managersSnap = await db.collection('managers').get()
  const reporteeCounts = new Map<string, number>()
  const reporteesSnap = await db.collection('reportees').get()
  for (const doc of reporteesSnap.docs) {
    const managerId = doc.data().managerId as string
    reporteeCounts.set(managerId, (reporteeCounts.get(managerId) ?? 0) + 1)
  }

  const metaRef = db.doc('meta/currentCycle')
  const metaSnap = await metaRef.get()
  const previousCycleId = metaSnap.exists ? (metaSnap.data()?.cycleId as string | undefined) : undefined

  const batch = db.batch()

  const newCycleRef = db.collection('cycles').doc()
  batch.set(newCycleRef, { label, status: 'open', openedAt: new Date().toISOString() })

  for (const managerDoc of managersSnap.docs) {
    const allocated = calcDefaultCredits(reporteeCounts.get(managerDoc.id) ?? 0)
    const allocationRef = newCycleRef.collection('allocations').doc(managerDoc.id)
    batch.set(allocationRef, { managerId: managerDoc.id, allocated })
  }

  if (previousCycleId) {
    batch.update(db.doc(`cycles/${previousCycleId}`), { status: 'closed' })
  }

  batch.set(metaRef, { cycleId: newCycleRef.id, label })

  await batch.commit()

  return { cycleId: newCycleRef.id, label }
})
