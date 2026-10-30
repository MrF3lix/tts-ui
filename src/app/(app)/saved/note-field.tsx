"use client"

import { Textarea } from "@/components/ui/textarea"
import { AutosaveStatus } from "@/components/autosave-status"
import { useAutosave } from "@/hooks/use-autosave"
import { saveNote } from "./actions"

/** A sample's note, saved automatically while typing and when the field loses focus. */
export function NoteField({ id, initial }: { id: string; initial: string }) {
  const note = useAutosave(initial, async (value) => {
    const result = await saveNote(id, value)
    return "error" in result ? result : { value: result.note }
  })

  return (
    <div className="grid gap-1">
      <Textarea
        aria-label="Notes"
        rows={3}
        maxLength={5000}
        value={note.value}
        placeholder="Add a note"
        className="text-sm"
        onChange={(e) => note.change(e.target.value)}
        onBlur={note.flush}
      />
      <AutosaveStatus status={note.status} />
    </div>
  )
}
