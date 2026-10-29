// Types and helpers for the TTS gateway's API (see tts-api/docs/client-integration.md).
// Shared by server and client code.

export type Language = { code: string; name: string }

export type ModelInfo = {
  id: string
  name: string
  backend: string
  // whether the model uses a transcript of the reference recording
  ref_text: "ignored" | "optional" | "required"
  languages: Language[]
  workers: number
}

export type SampleStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type Sample = {
  index: number
  status: SampleStatus
  seed: number
  url?: string
  duration_s?: number
  error?: string
}

export type Job = {
  id: string
  status: SampleStatus
  model: string
  language: string
  text: string
  ref_text: string | null
  created_at: number
  samples_total: number
  samples_completed: number
  samples: Sample[]
  queue_position: number | null
  eta_seconds: number | null
}

// mirror the gateway's limits (configs/api.yaml) so the form can say so before submitting
export const MAX_TEXT_CHARS = 1000
export const MAX_REF_TEXT_CHARS = 1000
export const MAX_SPEAKER_SECONDS = 60
export const MAX_SAMPLES = 8
export const DEFAULT_SAMPLES = 1

const FINISHED = new Set<SampleStatus>(["completed", "failed", "cancelled"])

// a cancelled job can still have running samples, so look at the samples, not the job status
export function isFinished(job: Job): boolean {
  return job.samples.every((s) => FINISHED.has(s.status))
}

/** The message of a gateway error response: {"detail": "..."} or FastAPI's validation list. */
export async function errorMessage(response: Response): Promise<string> {
  try {
    const { detail } = await response.json()
    if (typeof detail === "string") {
      return detail
    }
    if (Array.isArray(detail)) {
      return detail.map((d) => `${d.loc?.at(-1) ?? "input"}: ${d.msg}`).join("; ")
    }
  } catch {
    // not JSON
  }
  return `Request failed (${response.status})`
}
