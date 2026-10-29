import type { AutosaveStatus as Status } from "@/hooks/use-autosave"

/** "Saving…", "Saved" or an error under an autosaving field; keeps its height while empty. */
export function AutosaveStatus({ status }: { status: Status }) {
  return (
    <p aria-live="polite" className={status.state === "error" ? "text-xs text-destructive" : "h-4 text-xs text-muted-foreground"}>
      {status.state === "saving" && "Saving…"}
      {status.state === "saved" && "Saved"}
      {status.state === "error" && status.message}
    </p>
  )
}
