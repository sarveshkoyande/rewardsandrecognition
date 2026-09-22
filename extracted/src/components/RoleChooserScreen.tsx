import type { Role } from '../hooks/useAuth'

export function RoleChooserScreen({
  email,
  onChoose,
  onSignOut,
}: {
  email: string
  onChoose: (role: Role) => void
  onSignOut: () => Promise<void>
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="ds-card p-8 max-w-sm w-full text-center space-y-4">
        <p className="ds-title-m">Continue as…</p>
        <p className="ds-body-s text-[var(--muted-foreground)]">
          <strong className="text-[var(--foreground)]">{email}</strong> has both admin and manager access. Pick which one for this session.
        </p>
        <button className="btn btn-filled btn-lg w-full" onClick={() => onChoose('admin')}>
          Continue as Admin
        </button>
        <button className="btn btn-outlined btn-lg w-full" onClick={() => onChoose('manager')}>
          Continue as Manager
        </button>
        <button className="btn btn-text btn-sm" onClick={() => onSignOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
