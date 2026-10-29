"use client"

import { Input } from "@/components/ui/input"
import { AutosaveStatus } from "@/components/autosave-status"
import { useAutosave } from "@/hooks/use-autosave"
import type { Speaker } from "@/lib/speakers"
import { renameSpeaker } from "./actions"

export function SpeakerRow({ speaker }: { speaker: Speaker }) {
  const name = useAutosave(
    speaker.name,
    async (value) => {
      const result = await renameSpeaker(speaker.id, value)
      return "error" in result ? result : { value: result.name }
    },
    (value) => (value.trim() ? null : "The name must not be empty."),
  )

  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="grid gap-1">
        <Input
          aria-label="Speaker name"
          value={name.value}
          maxLength={200}
          onChange={(e) => name.change(e.target.value)}
          onBlur={() => {
            // an emptied name isn't saved; leaving the field brings the saved one back
            if (!name.value.trim()) name.revert()
            else name.flush()
          }}
        />
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">Added {new Date(speaker.created).toLocaleString()}</p>
          <AutosaveStatus status={name.status} />
        </div>
      </div>
      <audio controls preload="none" src={`/api/speakers/${speaker.id}/audio`} className="h-8 w-full sm:w-72" />
    </li>
  )
}
