import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'

export interface RosterRow {
  manager_name: string
  manager_email: string
  reportee_name: string
  reportee_designation: string
}

export type RosterRowResult =
  | { row: number; status: 'created'; managerId: string; reporteeId: string }
  | { row: number; status: 'skipped'; reason: string }

function requireAdmin(auth: { token?: Record<string, any> } | undefined) {
  if (!auth || auth.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only an admin can import the roster.')
  }
}

/**
 * Creates the full manager/reportee tree from one CSV pass (R4, KTD3, AE1).
 * Managers are upserted by email so repeated rows for the same manager add
 * more reportees under one manager doc rather than duplicating it.
 * Each row is validated independently -- one malformed row is skipped and
 * reported, it does not fail the whole import.
 */
export const importRoster = onCall<{ rows: RosterRow[] }>(async (request) => {
  requireAdmin(request.auth)

  const rows = request.data?.rows ?? []
  const db = getFirestore()
  const results: RosterRowResult[] = []
  const managerIdByEmail = new Map<string, string>()

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

    let managerId = managerIdByEmail.get(managerEmail)
    if (!managerId) {
      const existing = await db.collection('managers').where('email', '==', managerEmail).limit(1).get()
      if (!existing.empty) {
        managerId = existing.docs[0].id
      } else {
        const created = await db
          .collection('managers')
          .add({ name: managerName, email: managerEmail, designation: '' })
        managerId = created.id
      }
      managerIdByEmail.set(managerEmail, managerId)
    }

    const reportee = await db
      .collection('reportees')
      .add({ managerId, name: reporteeName, designation: reporteeDesignation })

    results.push({ row: i, status: 'created', managerId, reporteeId: reportee.id })
  }

  return { results }
})
