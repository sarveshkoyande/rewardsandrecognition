import { initializeApp } from 'firebase-admin/app'

initializeApp()

export { beforeSignIn } from './auth/beforeSignIn'
export { importRoster } from './roster/importRoster'
export { adminEditRoster } from './roster/adminEditRoster'
export { openCycle } from './cycles/openCycle'
