export function BlockedScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="bg-[var(--card)] border border-[var(--warning-foreground)]/20 rounded-lg p-8 max-w-sm w-full text-center space-y-4">
        <p className="text-[var(--warning-foreground)] bg-[var(--warning-light-background)] border border-[var(--warning-foreground)]/20 rounded-md px-4 py-3 text-sm">
          {message}
        </p>
        <button
          onClick={onRetry}
          className="text-sm text-[var(--primary)] hover:underline"
        >
          Try a different account
        </button>
      </div>
    </div>
  )
}
