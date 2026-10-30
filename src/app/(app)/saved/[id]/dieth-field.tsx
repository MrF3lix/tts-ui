"use client"

import { AutosaveStatus } from "@/components/autosave-status"
import { Textarea } from "@/components/ui/textarea"
import { useAutosave } from "@/hooks/use-autosave"
import { saveDieth } from "./actions"

/** A transcript of the sample in Dieth spelling, saved automatically like notes. */
export function DiethField({ id, initial }: { id: string; initial: string }) {
  const dieth = useAutosave(initial, async (value) => {
    const result = await saveDieth(id, value)
    return "error" in result ? result : { value: result.dieth }
  })

  return (
    <div className="grid gap-1">
      <Textarea
        id="dieth"
        rows={3}
        maxLength={5000}
        value={dieth.value}
        placeholder="Transcribe what is said, in Dieth spelling"
        lang="gsw"
        spellCheck={false}
        className="text-sm"
        onChange={(e) => dieth.change(e.target.value)}
        onBlur={dieth.flush}
      />
      <AutosaveStatus status={dieth.status} />
    </div>
  )
}
