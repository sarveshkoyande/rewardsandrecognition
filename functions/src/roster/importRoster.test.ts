import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Doc {
  id: string
  data: Record<string, unknown>
}

const store: Record<string, Doc[]> = { managers: [], reportees: [] }
let nextId = 1

function collectionApi(name: string) {
  return {
    where(field: string, _op: '==', value: unknown) {
      return {
        limit() {
          return {
            async get() {
              const docs = store[name].filter((d) => d.data[field] === value)
              return { empty: docs.length === 0, docs: docs.map((d) => ({ id: d.id })) }
            },
          }
        },
      }
    },
    async add(data: Record<string, unknown>) {
      const id = `id${nextId++}`
      store[name].push({ id, data })
      return { id }
    },
  }
}

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: (name: string) => collectionApi(name) }),
}))

class HttpsErrorMock extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: HttpsErrorMock,
  onCall: (handler: (req: unknown) => unknown) => handler,
}))

const { importRoster } = await import('./importRoster')

type Handler = (req: { auth?: { token?: { role?: string } }; data: unknown }) => Promise<unknown>

const adminRequest = (rows: unknown[]) => ({ auth: { token: { role: 'admin' } }, data: { rows } })

describe('importRoster', () => {
  beforeEach(() => {
    store.managers = []
    store.reportees = []
    nextId = 1
  })

  it('creates a manager and reportee for a valid row', async () => {
    const result: any = await (importRoster as unknown as Handler)(
      adminRequest([
        { manager_name: 'Ashruti Sharma', manager_email: 'ashruti@acme.com', reportee_name: 'Sanket Patil', reportee_designation: 'Senior Engineer' },
      ])
    )
    expect(result.results).toEqual([{ row: 0, status: 'created', managerId: 'id1', reporteeId: 'id2' }])
    expect(store.managers).toHaveLength(1)
    expect(store.reportees).toHaveLength(1)
  })

  it('reuses the same manager doc for repeated rows with the same email (AE1)', async () => {
    await (importRoster as unknown as Handler)(
      adminRequest([
        { manager_name: 'Ashruti Sharma', manager_email: 'ashruti@acme.com', reportee_name: 'Sanket Patil', reportee_designation: 'Senior Engineer' },
        { manager_name: 'Ashruti Sharma', manager_email: 'ashruti@acme.com', reportee_name: 'Priya Nair', reportee_designation: 'Engineer' },
      ])
    )
    expect(store.managers).toHaveLength(1)
    expect(store.reportees).toHaveLength(2)
    expect(store.reportees.every((r) => r.data.managerId === store.managers[0].id)).toBe(true)
  })

  it('skips a row with a blank manager email and reports the reason', async () => {
    const result: any = await (importRoster as unknown as Handler)(
      adminRequest([{ manager_name: 'No Email', manager_email: '', reportee_name: 'X', reportee_designation: '' }])
    )
    expect(result.results[0]).toMatchObject({ status: 'skipped' })
    expect(store.managers).toHaveLength(0)
  })

  it('does not fail the whole import when one row is malformed', async () => {
    const result: any = await (importRoster as unknown as Handler)(
      adminRequest([
        { manager_name: '', manager_email: '', reportee_name: '', reportee_designation: '' },
        { manager_name: 'Ashruti Sharma', manager_email: 'ashruti@acme.com', reportee_name: 'Sanket Patil', reportee_designation: '' },
      ])
    )
    expect(result.results[0].status).toBe('skipped')
    expect(result.results[1].status).toBe('created')
  })

  it('rejects a non-admin caller', async () => {
    await expect(
      (importRoster as unknown as Handler)({ auth: { token: { role: 'manager' } }, data: { rows: [] } })
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
