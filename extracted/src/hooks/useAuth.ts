import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
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
  needsVerification: boolean
  /** Every role this account resolved to (admin/manager doc both matched by email). Length 2 means the person must pick before `role` is set. */
  availableRoles: Role[]
}

const CONTACT_ADMIN_MESSAGE = 'Your account is not set up yet. Contact your admin.'

const EMPTY_STATE: AuthState = {
  loading: false,
  user: null,
  role: null,
  managerId: null,
  blockedMessage: null,
  needsVerification: false,
  availableRoles: [],
}

function isPasswordAccount(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password')
}

/**
 * The free Spark plan has no Cloud Functions, so there is no blocking
 * sign-in step and no custom claims. Role is resolved here, client-side,
 * by checking whether a doc keyed to the signed-in email exists in
 * admins/ or managers/ (R2, R3) -- and Firestore security rules
 * independently deny all data access to an email that matches neither, so
 * an unmapped account is locked out even if this client-side check were
 * bypassed. An unmapped account is signed out immediately rather than left
 * holding a live session with nothing to do.
 *
 * An email can match BOTH admins/ and managers/ (the same person is on
 * both lists) -- in that case `role` stays null and `availableRoles` holds
 * both until chooseRole() picks one. This does not re-authenticate; it is
 * a pure client-side choice the person can revisit with switchRole().
 *
 * Email/password accounts additionally gate on emailVerified: Google's
 * sign-in already guarantees the signed-in email belongs to that person,
 * but self-service email/password sign-up doesn't -- without this gate,
 * anyone could sign up using a colleague's roster email before that
 * colleague does, and inherit their manager access by email match alone.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ ...EMPTY_STATE, loading: true })

  async function resolveUser(user: User) {
    if (!user.email) {
      setState({ ...EMPTY_STATE, loading: false })
      return
    }

    if (isPasswordAccount(user) && !user.emailVerified) {
      setState({ ...EMPTY_STATE, loading: false, user, needsVerification: true })
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

      // managers/{email} is always readable by the signed-in user checking
      // their own email (isOwnManagerId), regardless of whether it exists.
      const isManagerUser = (await getDoc(doc(db, 'managers', email))).exists()

      const availableRoles: Role[] = [...(isAdminUser ? (['admin'] as const) : []), ...(isManagerUser ? (['manager'] as const) : [])]

      if (availableRoles.length === 0) {
        await firebaseSignOut(auth)
        setState({ ...EMPTY_STATE, loading: false, blockedMessage: CONTACT_ADMIN_MESSAGE })
        return
      }

      const managerId = isManagerUser ? email : null
      // Only one role matched -- resolve directly, no picker needed.
      const role = availableRoles.length === 1 ? availableRoles[0] : null

      setState({ loading: false, user, role, managerId, blockedMessage: null, needsVerification: false, availableRoles })
    } catch {
      // Any unexpected Firestore failure (rules not deployed yet, network
      // blip, project misconfigured) must still resolve loading -- getting
      // stuck on "Loading..." forever is worse than a signed-out retry state.
      await firebaseSignOut(auth).catch(() => {})
      setState({
        ...EMPTY_STATE,
        loading: false,
        blockedMessage: "Couldn't verify your account. Try signing in again in a moment.",
      })
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ...EMPTY_STATE, loading: false })
        return
      }
      await resolveUser(user)
    })
  }, [])

  function authErrorMessage(err: unknown): string {
    const code = (err as { code?: string })?.code ?? ''
    switch (code) {
      case 'auth/unauthorized-domain':
        return "This site isn't authorized for sign-in yet. Ask your admin to add this domain in Firebase Authentication settings."
      case 'auth/popup-blocked':
        return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
      case 'auth/email-already-in-use':
        return 'An account already exists for that email. Try signing in instead, or use "Forgot password?" if you don\'t remember it.'
      case 'auth/invalid-email':
        return 'That doesn\'t look like a valid email address.'
      case 'auth/weak-password':
        return 'Password is too weak -- use at least 6 characters.'
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a moment and try again.'
      default:
        return `Something went wrong (${code || 'unknown error'}). Try again.`
    }
  }

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
      setState((s) => ({ ...s, blockedMessage: authErrorMessage(err) }))
    }
  }

  /** Self-service sign-up: creates the Firebase Auth account and sends the verification email. The admin still owns whether that email is actually on the roster. */
  async function signUpWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await sendEmailVerification(cred.user)
      return { error: null }
    } catch (err) {
      return { error: authErrorMessage(err) }
    }
  }

  async function signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return { error: null }
    } catch (err) {
      return { error: authErrorMessage(err) }
    }
  }

  async function resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      await sendPasswordResetEmail(auth, email.trim())
      return { error: null }
    } catch (err) {
      return { error: authErrorMessage(err) }
    }
  }

  /** Resends the verification email to the currently signed-in (but unverified) user. */
  async function resendVerificationEmail(): Promise<{ error: string | null }> {
    if (!auth.currentUser) return { error: 'No account is signed in.' }
    try {
      await sendEmailVerification(auth.currentUser)
      return { error: null }
    } catch (err) {
      return { error: authErrorMessage(err) }
    }
  }

  /** Re-checks verification status after the user clicks the link in their inbox (Firebase doesn't push this change to an already-open tab). */
  async function recheckVerification() {
    if (!auth.currentUser) return
    await auth.currentUser.reload()
    await resolveUser(auth.currentUser)
  }

  /** Picks which role to use for this session -- pure client state, no re-authentication. */
  function chooseRole(role: Role) {
    setState((s) => (s.availableRoles.includes(role) ? { ...s, role } : s))
  }

  /** Lets a dual-access person go back to the picker without signing out. */
  function switchRole() {
    setState((s) => (s.availableRoles.length > 1 ? { ...s, role: null } : s))
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return {
    ...state,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    resendVerificationEmail,
    recheckVerification,
    chooseRole,
    switchRole,
    signOut,
  }
}
