import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Doc {
  id: string
  data: Record<string, unknown>
}

const store: Record<string, Doc[]> = { managers: [], reportees: [] }
const docStore: Record<string, Record<string, unknown>> = {}
let nextId = 1

function collectionApi(name: string) {
  return {
    where(field: string, _op: '==', value: unknown) {
      return {
        async get() {
          const docs = store[name].filter((d) => d.data[field] === value)
          return { size: docs.length, docs: docs.map((d) => ({ id: d.id })) }
        },
      }
    },
    async add(data: Record<string, unknown>) {
      const id = `id${nextId++}`
      store[name].push({ id, data })
      return { id }
    },
    doc(id: string) {
      return {
        async delete() {
          store[name] = store[name].filter((d) => d.id !== id)
        },
      }
    },
  }
}

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => collectionApi(name),
    doc: (path: string) => ({
      async set(data: Record<string, unknown>) {
        docStore[path] = data
      },
      async get() {
        const data = docStore[path]
        return { exists: data !== undefined, data: () => data }
      },
    }),
  }),
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

const { adminEditRoster } = await import('./adminEditRoster')

type Handler = (req: { auth?: { token?: { role?: string } }; data: unknown }) => Promise<any>
const admin = (data: unknown) => ({ auth: { token: { role: 'admin' } }, data })

describe('adminEditRoster', () => {
  beforeEach(() => {
    store.managers = []
    store.reportees = []
    for (const k of Object.keys(docStore)) delete docStore[k]
    nextId = 1
  })

  it('addManager creates a manager doc', async () => {
    const result = await (adminEditRoster as unknown as Handler)(
      admin({ action: 'addManager', name: 'A', email: 'a@acme.com' })
    )
    expect(store.managers).toHaveLength(1)
    expect(result.managerId).toBe(store.managers[0].id)
  })

  it('removeReportee deletes the doc', async () => {
    store.reportees = [{ id: 'r1', data: { managerId: 'm1', name: 'X' } }]
    await (adminEditRoster as unknown as Handler)(admin({ action: 'removeReportee', reporteeId: 'r1' }))
    expect(store.reportees).toHaveLength(0)
  })

  it('setAllocation writes an explicit value for the current cycle', async () => {
    docStore['meta/currentCycle'] = { cycleId: 'c1', label: 'Sep 2026' }
    await (adminEditRoster as unknown as Handler)(
      admin({ action: 'setAllocation', cycleId: 'c1', managerId: 'm1', allocated: 7 })
    )
    expect(docStore['cycles/c1/allocations/m1']).toEqual({ managerId: 'm1', allocated: 7 })
  })

  it('resetAllocation recomputes from reportee count for the current cycle', async () => {
    docStore['meta/currentCycle'] = { cycleId: 'c1', label: 'Sep 2026' }
    store.reportees = [
      { id: 'r1', data: { managerId: 'm1' } },
      { id: 'r2', data: { managerId: 'm1' } },
    ]
    await (adminEditRoster as unknown as Handler)(admin({ action: 'resetAllocation', cycleId: 'c1', managerId: 'm1' }))
    expect(docStore['cycles/c1/allocations/m1']).toEqual({ managerId: 'm1', allocated: 0 })
  })

  it('rejects setAllocation against a closed (non-current) cycle', async () => {
    docStore['meta/currentCycle'] = { cycleId: 'c2', label: 'Oct 2026' }
    await expect(
      (adminEditRoster as unknown as Handler)(
        admin({ action: 'setAllocation', cycleId: 'c1', managerId: 'm1', allocated: 7 })
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(docStore['cycles/c1/allocations/m1']).toBeUndefined()
  })

  it('rejects resetAllocation when no cycle has ever been opened', async () => {
    await expect(
      (adminEditRoster as unknown as Handler)(admin({ action: 'resetAllocation', cycleId: 'c1', managerId: 'm1' }))
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('rejects a non-admin caller', async () => {
    await expect(
      (adminEditRoster as unknown as Handler)({ auth: { token: { role: 'manager' } }, data: { action: 'addManager', name: 'A', email: 'a@acme.com' } })
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
