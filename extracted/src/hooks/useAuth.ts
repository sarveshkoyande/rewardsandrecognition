import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

export type Role = 'admin' | 'manager'

interface AuthState {
  loading: boolean
  user: User | null
  role: Role | null
  managerId: string | null
  blockedMessage: string | null
}

const CONTACT_ADMIN_MESSAGE = 'Your account is not set up yet. Contact your admin.'

/**
 * A beforeSignIn blocking-function rejection (U3) never reaches this app as
 * a signed-in user -- Firebase Auth surfaces it as a rejected sign-in
 * promise, not an authStateChanged event. We treat any sign-in-time error as
 * "blocked" and show the contact-admin message rather than a raw SDK error,
 * since the only server-side rejection reason in this app is R2's unmapped
 * account case.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    role: null,
    managerId: null,
    blockedMessage: null,
  })

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ loading: false, user: null, role: null, managerId: null, blockedMessage: null })
        return
      }
      const tokenResult = await user.getIdTokenResult(true)
      const role = (tokenResult.claims.role as Role | undefined) ?? null
      const managerId = (tokenResult.claims.managerId as string | undefined) ?? null
      setState({ loading: false, user, role, managerId, blockedMessage: null })
    })
  }, [])

  async function signInWithGoogle() {
    setState((s) => ({ ...s, blockedMessage: null }))
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      // A rejected beforeSignIn call is the only expected failure mode here.
      setState((s) => ({ ...s, blockedMessage: CONTACT_ADMIN_MESSAGE }))
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return { ...state, signInWithGoogle, signOut }
}
