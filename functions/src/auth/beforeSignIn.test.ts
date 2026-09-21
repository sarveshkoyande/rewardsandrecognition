import { describe, expect, it, vi } from 'vitest'

const rosterLookupMock = vi.fn()
vi.mock('../lib/rosterLookup', () => ({ rosterLookup: rosterLookupMock }))

// firebase-functions/v2/identity's beforeUserSignedIn just returns the handler
// wrapped in a CloudFunction-shaped object; for a unit test we only need the
// handler itself, so we invoke the exported function's handler directly by
// mocking the wrapper to return the raw callback.
vi.mock('firebase-functions/v2/identity', async () => {
  class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }
  return {
    HttpsError,
    beforeUserSignedIn: (handler: (event: unknown) => unknown) => handler,
  }
})

const { beforeSignIn } = await import('./beforeSignIn')

describe('beforeSignIn', () => {
  it('mints manager claims for a mapped manager email', async () => {
    rosterLookupMock.mockResolvedValueOnce({ role: 'manager', managerId: 'm1' })
    const result = await (beforeSignIn as unknown as (e: { data: { email: string } }) => Promise<unknown>)({
      data: { email: 'manager@acme.com' },
    })
    expect(result).toEqual({ customClaims: { role: 'manager', managerId: 'm1' } })
  })

  it('mints admin claims for a mapped admin email', async () => {
    rosterLookupMock.mockResolvedValueOnce({ role: 'admin', managerId: null })
    const result = await (beforeSignIn as unknown as (e: { data: { email: string } }) => Promise<unknown>)({
      data: { email: 'admin@acme.com' },
    })
    expect(result).toEqual({ customClaims: { role: 'admin' } })
  })

  it('rejects sign-in for an unmapped email -- no session is ever created', async () => {
    rosterLookupMock.mockResolvedValueOnce(null)
    await expect(
      (beforeSignIn as unknown as (e: { data: { email: string } }) => Promise<unknown>)({
        data: { email: 'nobody@acme.com' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('fails closed when the roster lookup itself throws', async () => {
    rosterLookupMock.mockRejectedValueOnce(new Error('firestore unavailable'))
    await expect(
      (beforeSignIn as unknown as (e: { data: { email: string } }) => Promise<unknown>)({
        data: { email: 'manager@acme.com' },
      })
    ).rejects.toMatchObject({ code: 'internal' })
  })
})
