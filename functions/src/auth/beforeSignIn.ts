import { beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity'
import { rosterLookup } from '../lib/rosterLookup'

/**
 * Blocking sign-in function (KTD1). Runs on every Google sign-in.
 * A matched email gets role/managerId custom claims minted onto the token
 * before the client ever receives a session. An unmatched email is
 * rejected here -- no Firebase session is ever created, so the client
 * cannot read any Firestore data (covers R2, F2, AE2).
 */
export const beforeSignIn = beforeUserSignedIn(async (event) => {
  const email = event.data?.email
  if (!email) {
    throw new HttpsError('permission-denied', 'Your account is not set up yet. Contact your admin.')
  }

  let match
  try {
    match = await rosterLookup(email)
  } catch {
    // Fail closed: a lookup failure must never fall through to an open sign-in.
    throw new HttpsError('internal', 'Sign-in could not be verified. Try again shortly.')
  }

  if (!match) {
    throw new HttpsError('permission-denied', 'Your account is not set up yet. Contact your admin.')
  }

  return {
    customClaims:
      match.role === 'admin' ? { role: 'admin' } : { role: 'manager', managerId: match.managerId },
  }
})
