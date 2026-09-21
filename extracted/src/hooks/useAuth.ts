import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

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
 * The free Spark plan has no Cloud Functions, so there is no blocking
 * sign-in step and no custom claims. Role is resolved here, client-side,
 * by checking whether a doc keyed to the signed-in email exists in
 * admins/ or managers/ (R2, R3) -- and Firestore security rules
 * independently deny all data access to an email that matches neither, so
 * an unmapped account is locked out even if this client-side check were
 * bypassed. An unmapped account is signed out immediately rather than left
 * holding a live session with nothing to do.
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
      if (!user || !user.email) {
        setState({ loading: false, user: null, role: null, managerId: null, blockedMessage: null })
        return
      }

      const email = user.email.toLowerCase()

      try {
        // admins/{email} is only readable by an admin (firestore.rules), so a
        // non-admin's read is denied outright rather than resolving to "not
        // found" -- a permission-denied here just means "not an admin".
        let isAdminUser = false
        try {
          isAdminUser = (await getDoc(doc(db, 'admins', email))).exists()
        } catch {
          isAdminUser = false
        }
        if (isAdminUser) {
          setState({ loading: false, user, role: 'admin', managerId: null, blockedMessage: null })
          return
        }

        // managers/{email} is always readable by the signed-in user checking
        // their own email (isOwnManagerId), regardless of whether it exists.
        const managerSnap = await getDoc(doc(db, 'managers', email))
        if (managerSnap.exists()) {
          setState({ loading: false, user, role: 'manager', managerId: email, blockedMessage: null })
          return
        }

        await firebaseSignOut(auth)
        setState({ loading: false, user: null, role: null, managerId: null, blockedMessage: CONTACT_ADMIN_MESSAGE })
      } catch {
        // Any unexpected Firestore failure (rules not deployed yet, network
        // blip, project misconfigured) must still resolve loading -- getting
        // stuck on "Loading..." forever is worse than a signed-out retry state.
        await firebaseSignOut(auth).catch(() => {})
        setState({
          loading: false,
          user: null,
          role: null,
          managerId: null,
          blockedMessage: "Couldn't verify your account. Try signing in again in a moment.",
        })
      }
    })
  }, [])

  async function signInWithGoogle() {
    setState((s) => ({ ...s, blockedMessage: null }))
    try {
      await signInWithPopup(auth, googleProvider)
      // A successful popup lands here; onAuthStateChanged (above) then
      // resolves the unmapped-account case once the session exists.
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      // The user closing/cancelling the popup themselves isn't an error --
      // don't show a message for those, just let them try again.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return
      }
      const message =
        code === 'auth/unauthorized-domain'
          ? "This site isn't authorized for sign-in yet. Ask your admin to add this domain in Firebase Authentication settings."
          : code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
            : `Sign-in failed (${code || 'unknown error'}). Try again.`
      setState((s) => ({ ...s, blockedMessage: message }))
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return { ...state, signInWithGoogle, signOut }
}
