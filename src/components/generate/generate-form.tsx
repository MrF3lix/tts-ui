"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { SpeakerInput } from "@/components/generate/speaker-input"
import {
  DEFAULT_SAMPLES, MAX_REF_TEXT_CHARS, MAX_SAMPLES, MAX_TEXT_CHARS, errorMessage, type Job, type ModelInfo,
} from "@/lib/tts"
import type { Speaker } from "@/lib/speakers"
import type { WavFile } from "@/lib/wav"

type Props = {
  models: ModelInfo[]
  // the user's saved speakers, newest first
  speakers: Speaker[]
  // speakerId: the saved speaker the job used, if any
  onSubmitted: (job: Job, speakerId: string | null) => void
}

export function GenerateForm({ models, speakers, onSubmitted }: Props) {
  const router = useRouter()
  const [modelId, setModelId] = useState((models.find((m) => m.workers > 0) ?? models[0]).id)
  const model = models.find((m) => m.id === modelId)!
  const [language, setLanguage] = useState(model.languages[0]?.code ?? "")
  const [speaker, setSpeaker] = useState<WavFile | null>(null)
  // a saved speaker, or "" for a new upload or recording
  const [speakerId, setSpeakerId] = useState("")
  const [refText, setRefText] = useState("")
  const [text, setText] = useState("")
  const [numSamples, setNumSamples] = useState(DEFAULT_SAMPLES)
  const [seed, setSeed] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function changeModel(id: string) {
    const next = models.find((m) => m.id === id)!
    setModelId(id)
    // keep the language if the new model has it too
    if (!next.languages.some((l) => l.code === language)) {
      setLanguage(next.languages[0]?.code ?? "")
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!speaker && !speakerId) {
      setError("Add a reference recording of the voice first.")
      return
    }
    setError(null)
    setSubmitting(true)

    const body = new FormData()
    body.append("model", modelId)
    body.append("language", language)
    body.append("text", text.trim())
    body.append("num_samples", String(numSamples))
    if (speakerId) {
      body.append("speaker_id", speakerId)
    } else if (speaker) {
      body.append("speaker_wav", speaker.file)
    }
    if (model.ref_text !== "ignored" && refText.trim()) {
      body.append("ref_text", refText.trim())
    }
    if (seed.trim()) {
      body.append("seed", seed.trim())
    }

    try {
      const response = await fetch("/api/jobs", { method: "POST", body })
      if (response.status === 401) {
        // session expired or revoked
        router.push("/login")
      } else if (response.status === 429) {
        setError("The queue is full right now. Wait a moment and try again.")
      } else if (!response.ok) {
        setError(await errorMessage(response))
      } else {
        const savedId = response.headers.get("x-speaker-id")
        onSubmitted(await response.json(), savedId)
        // a new recording is now a saved speaker: select it, so the next job doesn't upload it again
        if (savedId && !speakerId) {
          setSpeakerId(savedId)
          setSpeaker(null)
          router.refresh()
        }
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const offline = model.workers === 0
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="model">Model</Label>
          <NativeSelect id="model" className="w-full" value={modelId} onChange={(e) => changeModel(e.target.value)}>
            {models.map((m) => (
              <NativeSelectOption key={m.id} value={m.id}>
                {m.name}{m.workers === 0 ? " (offline)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="language">Language</Label>
          <NativeSelect id="language" className="w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {model.languages.map((l) => (
              <NativeSelectOption key={l.code} value={l.code}>{l.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={speakers.length ? "speaker" : undefined}>Voice reference</Label>
        {speakers.length > 0 && (
          <NativeSelect id="speaker" className="w-full" value={speakerId} onChange={(e) => setSpeakerId(e.target.value)}>
            <NativeSelectOption value="">New reference (upload or record)</NativeSelectOption>
            {speakers.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {speakerId ? (
          <audio key={speakerId} controls preload="none" src={`/api/speakers/${speakerId}/audio`} className="w-full" />
        ) : (
          <SpeakerInput value={speaker} onChange={setSpeaker} />
        )}
      </div>

      {model.ref_text !== "ignored" && (
        <div className="grid gap-2">
          <Label htmlFor="ref_text">
            Transcript of the reference{model.ref_text === "optional" && <span className="font-normal text-muted-foreground">(optional)</span>}
          </Label>
          <Textarea
            id="ref_text"
            rows={2}
            maxLength={MAX_REF_TEXT_CHARS}
            required={model.ref_text === "required"}
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            placeholder="Exactly what is said in the recording"
          />
          <p className="text-sm text-muted-foreground">
            Improves how closely the voice is matched. It must match the recording word for word, otherwise the
            output can derail.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="text">Text</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{text.length} / {MAX_TEXT_CHARS}</span>
        </div>
        <Textarea
          id="text"
          rows={4}
          maxLength={MAX_TEXT_CHARS}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What the voice should say"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="num_samples">Variants</Label>
          <NativeSelect id="num_samples" className="w-full" value={numSamples}
                        onChange={(e) => setNumSamples(Number(e.target.value))}>
            {Array.from({ length: MAX_SAMPLES }, (_, i) => i + 1).map((n) => (
              <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seed">Seed <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="seed" type="number" min={0} step={1} inputMode="numeric" value={seed}
                 onChange={(e) => setSeed(e.target.value)} placeholder="Random" />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !text.trim() || (!speaker && !speakerId)}>
          {submitting ? "Submitting…" : "Generate"}
        </Button>
        {offline && (
          <span className="text-sm text-muted-foreground">No worker is running for this model; the job will wait.</span>
        )}
      </div>
    </form>
  )
}
