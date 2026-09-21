import { beforeEach, describe, expect, it, vi } from 'vitest'

const collections: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
  admins: [],
  managers: [],
}

function makeQuery(collectionName: string) {
  return {
    where(field: string, _op: '==', value: unknown) {
      return {
        limit() {
          return {
            async get() {
              const docs = collections[collectionName]
                .filter((d) => d.data[field] === value)
                .map((d) => ({ id: d.id, data: () => d.data }))
              return { empty: docs.length === 0, docs }
            },
          }
        },
      }
    },
  }
}

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => makeQuery(name),
  }),
}))

// Import after the mock is registered.
const { rosterLookup } = await import('./rosterLookup')

describe('rosterLookup', () => {
  beforeEach(() => {
    collections.admins = [{ id: 'a1', data: { email: 'admin@acme.com' } }]
    collections.managers = [{ id: 'm1', data: { email: 'manager@acme.com' } }]
  })

  it('returns admin role for a matched admin email', async () => {
    await expect(rosterLookup('admin@acme.com')).resolves.toEqual({ role: 'admin', managerId: null })
  })

  it('returns manager role and managerId for a matched manager email', async () => {
    await expect(rosterLookup('manager@acme.com')).resolves.toEqual({
      role: 'manager',
      managerId: 'm1',
    })
  })

  it('is case-insensitive on email matching', async () => {
    await expect(rosterLookup('Manager@Acme.com')).resolves.toEqual({
      role: 'manager',
      managerId: 'm1',
    })
  })

  it('returns null for an email matching neither collection', async () => {
    await expect(rosterLookup('nobody@acme.com')).resolves.toBeNull()
  })
})
