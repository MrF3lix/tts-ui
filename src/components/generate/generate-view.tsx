"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { GenerateForm } from "@/components/generate/generate-form"
import { JobCard } from "@/components/generate/job-card"
import type { Speaker } from "@/lib/speakers"
import type { Job, ModelInfo } from "@/lib/tts"

const MAX_JOBS = 20

// speakerId: the saved speaker the job used, so kept samples can be linked to it
type Entry = { id: string; speakerId: string | null; initial?: Job }
type Stored = { id: string; speakerId: string | null }

// The gateway can't list a user's jobs yet, so recent jobs are kept in this browser
// (the jobs themselves expire on the gateway after 24h).
function storageKey(userId: string) {
  return `tts.jobs.${userId}`
}

function load(userId: string): Stored[] {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]")
    if (!Array.isArray(items)) return []
    return items
      // earlier versions stored only the job id
      .map((item) => (typeof item === "string" ? { id: item, speakerId: null } : item))
      .filter((item): item is Stored => typeof item?.id === "string")
      .slice(0, MAX_JOBS)
  } catch {
    return []
  }
}

function save(userId: string, entries: Entry[]) {
  try {
    const stored: Stored[] = entries.map(({ id, speakerId }) => ({ id, speakerId }))
    localStorage.setItem(storageKey(userId), JSON.stringify(stored))
  } catch {
    // storage unavailable (private mode): the list just doesn't survive a reload
  }
}

export function GenerateView({ models, speakers, userId }: { models: ModelInfo[]; speakers: Speaker[]; userId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
    setEntries(load(userId))
  }, [userId])

  const update = useCallback((change: (entries: Entry[]) => Entry[]) => {
    setEntries((current) => {
      const next = change(current ?? []).slice(0, MAX_JOBS)
      save(userId, next)
      return next
    })
  }, [userId])

  const add = useCallback((job: Job, speakerId: string | null) =>
    update((list) => [{ id: job.id, speakerId, initial: job }, ...list]), [update])
  const remove = useCallback((id: string) => update((list) => list.filter((e) => e.id !== id)), [update])

  return (
    <div className="grid gap-8">
      <Card>
        <CardContent>
          <GenerateForm models={models} speakers={speakers} onSubmitted={add} />
        </CardContent>
      </Card>
      {entries && entries.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-medium">Recent jobs</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Results are deleted after 24 hours. Download or save what you want to keep.</p>
          {entries.map((entry) => (
            <JobCard key={entry.id} id={entry.id} speakerId={entry.speakerId} initial={entry.initial} models={models}
              onRemove={remove} />
          ))}
        </section>
      )}
    </div>
  )
}
