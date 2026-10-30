"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookmarkCheckIcon, BookmarkIcon, DownloadIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { errorMessage, isFinished, type Job, type ModelInfo, type Sample, type SampleStatus } from "@/lib/tts"

type Props = {
  id: string
  speakerId: string | null
  initial?: Job
  models: ModelInfo[]
  onRemove: (id: string) => void
}

const STATUS_LABEL: Record<SampleStatus, string> = {
  queued: "Waiting",
  running: "Generating",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
}

// muted tints: a light background with darker text, and a faint tint in dark mode
const STATUS_COLOR: Record<SampleStatus, string> = {
  queued: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  cancelled: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
}

/** One job with live progress and a player per finished sample. */
export function JobCard({ id, speakerId, initial, models, onRemove }: Props) {
  const [job, setJob] = useState<Job | null>(initial ?? null)
  const [stream, setStream] = useState(0)
  // indices of samples the user kept (saved permanently)
  const [kept, setKept] = useState<Set<number>>(new Set())
  const finished = job !== null && isFinished(job)

  // jobs restored after a reload start without data
  useEffect(() => {
    if (initial) return
    let active = true
    fetch(`/api/jobs/${id}`).then(async (response) => {
      if (!active) return
      if (response.status === 404) onRemove(id) // expired after 24h
      else if (response.ok) setJob(await response.json())
    })
    return () => { active = false }
  }, [id, initial, onRemove])

  // a restored job may have kept samples already
  useEffect(() => {
    if (initial) return
    let active = true
    fetch(`/api/jobs/${id}/kept`).then(async (response) => {
      if (active && response.ok) setKept(new Set(await response.json()))
    })
    return () => { active = false }
  }, [id, initial])

  // follow progress until every sample is finished
  useEffect(() => {
    if (job === null || finished) return
    const events = new EventSource(`/api/jobs/${id}/events`)
    events.addEventListener("job", (e) => setJob(JSON.parse(e.data)))
    events.addEventListener("end", (e) => {
      // close, or the browser reconnects and replays the finished job
      events.close()
      const { status } = JSON.parse(e.data)
      // the gateway ends long streams after 30 min even if the job still runs
      if (status === "queued" || status === "running") setStream((n) => n + 1)
    })
    events.onerror = () => {
      // CLOSED means an error response (e.g. 404); otherwise the browser reconnects by itself
      if (events.readyState !== EventSource.CLOSED) return
      fetch(`/api/jobs/${id}`).then(async (response) => {
        if (response.status === 404) onRemove(id)
        else if (response.ok) setJob(await response.json())
        setTimeout(() => setStream((n) => n + 1), 5000)
      }, () => setTimeout(() => setStream((n) => n + 1), 5000))
    }
    return () => events.close()
    // reopen only when a job becomes known, finishes, or a reconnect is due
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job === null, finished, stream, onRemove])

  async function cancel() {
    const response = await fetch(`/api/jobs/${id}`, { method: "DELETE" })
    if (response.ok) setJob(await response.json())
  }

  if (!job) {
    return <Card className="h-28 animate-pulse" />
  }

  const model = models.find((m) => m.id === job.model)
  const language = model?.languages.find((l) => l.code === job.language)?.name ?? job.language
  const done = job.samples.filter((s) => s.status !== "queued" && s.status !== "running").length

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-3 text-sm">{job.text}</p>
          <div className="flex shrink-0 items-center gap-1">
            <Badge className={cn("border-transparent", STATUS_COLOR[job.status])}>
              {STATUS_LABEL[job.status]}
            </Badge>
            {finished && (
              <Button variant="ghost" size="icon-sm" onClick={() => onRemove(id)} aria-label="Remove from list">
                <XIcon />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {model?.name ?? job.model} · {language} · {new Date(job.created_at * 1000).toLocaleString()}
        </p>
        {!finished && (
          <div className="grid gap-2">
            <Progress value={(done / job.samples_total) * 100} />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{progressText(job)}</span>
              {job.status !== "cancelled" && (
                <Button variant="outline" size="xs" onClick={cancel}>Cancel</Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-2">
        {job.samples.map((sample) => (
          <SampleRow
            key={sample.index}
            jobId={id}
            sample={sample}
            speakerId={speakerId}
            kept={kept.has(sample.index)}
            onKeptChange={(value) => setKept((current) => {
              const next = new Set(current)
              if (value) next.add(sample.index)
              else next.delete(sample.index)
              return next
            })}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function SampleRow({ jobId, sample, speakerId, kept, onKeptChange }: {
  jobId: string
  sample: Sample
  speakerId: string | null
  kept: boolean
  onKeptChange: (kept: boolean) => void
}) {
  const src = `/api/jobs/${jobId}/samples/${sample.index}`
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function toggleKeep() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`${src}/keep`, kept
        ? { method: "DELETE" }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speaker_id: speakerId }) })
      if (response.ok) {
        onKeptChange(!kept)
        // the browser may have the Saved page cached (back/forward), without this change
        router.refresh()
      } else {
        setError(await errorMessage(response))
      }
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/40 px-3 py-1.5 text-sm">
      <span className="w-6 text-muted-foreground tabular-nums">#{sample.index + 1}</span>
      {sample.status === "completed" ? (
        <>
          {/* own line on phones, where a player next to the details would be too narrow */}
          <audio controls preload="none" src={src} className="order-last h-8 w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1" />
          <span className="flex-1 text-xs text-muted-foreground tabular-nums sm:w-36 sm:flex-none sm:text-right">
            {sample.duration_s?.toFixed(1)} s · seed {sample.seed}
          </span>
          <a href={`${src}?download=1`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
             aria-label={`Download variant ${sample.index + 1}`}>
            <DownloadIcon />
          </a>
          <Button variant="outline" size="xs" disabled={pending} onClick={toggleKeep} aria-pressed={kept}
                  title={kept ? "Saved permanently; click to remove from saved samples" : "Save permanently"}
                  className={cn("w-19", kept && "border-transparent bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white dark:bg-emerald-600 dark:hover:bg-emerald-700")}>
            {kept ? <BookmarkCheckIcon /> : <BookmarkIcon />} {kept ? "Saved" : "Save"}
          </Button>
          {error && <span className="basis-full text-xs text-destructive">{error}</span>}
        </>
      ) : (
        <span className={sample.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
          {STATUS_LABEL[sample.status]}{sample.error ? `: ${sample.error}` : sample.status === "running" ? "…" : ""}
        </span>
      )}
    </div>
  )
}

function progressText(job: Job): string {
  const eta = job.eta_seconds === null ? "" : ` · about ${formatSeconds(job.eta_seconds)} left`
  if (job.status === "queued") {
    const ahead = job.queue_position ? ` · ${job.queue_position} ahead in the queue` : ""
    return `Waiting for a free worker${ahead}${eta}`
  }
  if (job.status === "cancelled") {
    return "Cancelled; variants already started still finish"
  }
  return `${job.samples_completed} of ${job.samples_total} done${eta}`
}

function formatSeconds(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`
}
