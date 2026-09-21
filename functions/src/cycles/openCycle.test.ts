import { beforeEach, describe, expect, it, vi } from 'vitest'

interface BatchOp {
  type: 'set' | 'update'
  path: string
  data: Record<string, unknown>
}

let managers: Array<{ id: string; data: Record<string, unknown> }> = []
let reportees: Array<{ id: string; data: Record<string, unknown> }> = []
let metaDoc: { exists: boolean; data: () => Record<string, unknown> } | null = null
let committedOps: BatchOp[] = []
let idCounter = 1

function makeDocRef(path: string) {
  return {
    path,
    id: path.split('/').pop()!,
    collection: (sub: string) => makeCollectionRef(`${path}/${sub}`),
    async get() {
      if (path === 'meta/currentCycle') {
        return metaDoc ?? { exists: false, data: () => ({}) }
      }
      throw new Error(`unexpected get on ${path}`)
    },
  }
}

function makeCollectionRef(path: string) {
  return {
    doc: (id?: string) => makeDocRef(`${path}/${id ?? `auto${idCounter++}`}`),
    async get() {
      if (path === 'managers') return { docs: managers.map((m) => ({ id: m.id, data: () => m.data })) }
      if (path === 'reportees') return { docs: reportees.map((r) => ({ id: r.id, data: () => r.data })) }
      throw new Error(`unexpected collection get on ${path}`)
    },
  }
}

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => makeCollectionRef(name),
    doc: (path: string) => makeDocRef(path),
    batch: () => ({
      set(ref: { path: string }, data: Record<string, unknown>) {
        committedOps.push({ type: 'set', path: ref.path, data })
      },
      update(ref: { path: string }, data: Record<string, unknown>) {
        committedOps.push({ type: 'update', path: ref.path, data })
      },
      async commit() {
        return committedOps
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

const { openCycle } = await import('./openCycle')

type Handler = (req: { auth?: { token?: { role?: string } }; data: unknown }) => Promise<{ cycleId: string; label: string }>

const adminRequest = (label: string) => ({ auth: { token: { role: 'admin' } }, data: { label } })

describe('openCycle', () => {
  beforeEach(() => {
    committedOps = []
    idCounter = 1
    metaDoc = null
    managers = [
      { id: 'm1', data: {} },
      { id: 'm2', data: {} },
      { id: 'm3', data: {} },
    ]
    reportees = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `r1-${i}`, data: { managerId: 'm1' } })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `r2-${i}`, data: { managerId: 'm2' } })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `r3-${i}`, data: { managerId: 'm3' } })),
    ]
  })

  it('allocates 40% of headcount per manager (R7)', async () => {
    await (openCycle as unknown as Handler)(adminRequest('Oct 2026'))
    const allocations = committedOps.filter((op) => op.path.includes('/allocations/'))
    const byManager = Object.fromEntries(allocations.map((op) => [op.data.managerId, op.data.allocated]))
    expect(byManager).toEqual({ m1: 4, m2: 3, m3: 2 })
  })

  it('closes the previous cycle and points meta/currentCycle at the new one (R8, AE3)', async () => {
    metaDoc = { exists: true, data: () => ({ cycleId: 'oldCycle', label: 'Sep 2026' }) }
    const result = await (openCycle as unknown as Handler)(adminRequest('Oct 2026'))

    const closeOp = committedOps.find((op) => op.path === 'cycles/oldCycle')
    expect(closeOp).toMatchObject({ type: 'update', data: { status: 'closed' } })

    const metaOp = committedOps.find((op) => op.path === 'meta/currentCycle')
    expect(metaOp?.data).toMatchObject({ cycleId: result.cycleId })
  })

  it('rejects a non-admin caller', async () => {
    await expect(
      (openCycle as unknown as Handler)({ auth: { token: { role: 'manager' } }, data: { label: 'Oct 2026' } })
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('rejects an empty label', async () => {
    await expect((openCycle as unknown as Handler)(adminRequest('  '))).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })
})
