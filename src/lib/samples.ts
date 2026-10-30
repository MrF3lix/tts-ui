import "server-only"
import { Zip, ZipDeflate, ZipPassThrough } from "fflate"
import { ClientResponseError, type RecordModel } from "pocketbase"
import { getCurrentUser, requireToken } from "@/lib/auth"
import { fetchGateway, getModels } from "@/lib/gateway"
import { createPocketBase } from "@/lib/pocketbase"
import type { Job } from "@/lib/tts"

export type SavedSample = {
  id: string
  text: string
  language: string
  model: string
  seed: number
  duration_s: number
  note: string
  created: string
  speakerName: string | null
}

export const PAGE_SIZE = 50

export class KeepError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function jobFilter(pb: ReturnType<typeof createPocketBase>, userId: string, jobId: string, index?: number) {
  return index === undefined
    ? pb.filter("owner = {:owner} && job_id = {:job}", { owner: userId, job: jobId })
    : pb.filter("owner = {:owner} && job_id = {:job} && sample_index = {:index}", { owner: userId, job: jobId, index })
}

/**
 * Copies a finished sample from the gateway (which deletes it after 24h) into the user's saved
 * samples, with the job's settings. Keeping the same sample twice returns the existing record.
 */
export async function keepSample(token: string, userId: string, jobId: string, index: number, speakerId: string | null): Promise<string> {
  const pb = createPocketBase(token)
  const existing = await pb.collection("samples").getList(1, 1, { filter: jobFilter(pb, userId, jobId, index), fields: "id" })
  if (existing.items.length) {
    return existing.items[0].id
  }

  const jobResponse = await fetchGateway(token, `/jobs/${jobId}`)
  if (jobResponse.status === 404) {
    throw new KeepError("This job has expired.", 404)
  }
  if (!jobResponse.ok) {
    throw new KeepError("The TTS service is not reachable.", 502)
  }
  const job: Job = await jobResponse.json()
  const sample = job.samples.find((s) => s.index === index)
  if (!sample || sample.status !== "completed") {
    throw new KeepError("This variant is not finished.", 409)
  }
  const audio = await fetchGateway(token, `/jobs/${jobId}/samples/${index}.wav`)
  if (!audio.ok) {
    throw new KeepError(audio.status === 404 ? "This variant has expired." : "The TTS service is not reachable.", audio.status === 404 ? 404 : 502)
  }

  try {
    const record = await pb.collection("samples").create({
      owner: userId,
      speaker: speakerId ?? "",
      audio: new File([await audio.arrayBuffer()], `${jobId}-${index}.wav`, { type: "audio/wav" }),
      text: job.text,
      ref_text: job.ref_text ?? "",
      language: job.language,
      model: job.model,
      seed: sample.seed,
      duration_s: sample.duration_s ?? 0,
      job_id: jobId,
      sample_index: index,
    }, { fields: "id" })
    return record.id
  } catch (e) {
    // kept twice at the same time (unique index on job_id + sample_index)
    if (e instanceof ClientResponseError && e.status === 400) {
      const again = await pb.collection("samples").getList(1, 1, { filter: jobFilter(pb, userId, jobId, index), fields: "id" })
      if (again.items.length) return again.items[0].id
      // e.g. a speaker of another user or a deleted one
      throw new KeepError("The sample could not be saved.", 400)
    }
    throw e
  }
}

export async function unkeepSample(token: string, userId: string, jobId: string, index: number) {
  const pb = createPocketBase(token)
  const existing = await pb.collection("samples").getList(1, 1, { filter: jobFilter(pb, userId, jobId, index), fields: "id" })
  for (const record of existing.items) {
    await pb.collection("samples").delete(record.id)
  }
}

/** Indices of a job's samples that the user has kept. */
export async function keptIndices(token: string, userId: string, jobId: string): Promise<number[]> {
  const pb = createPocketBase(token)
  const records = await pb.collection("samples").getFullList({ filter: jobFilter(pb, userId, jobId), fields: "sample_index" })
  return records.map((r) => r.sample_index)
}

/** One page of the signed-in user's saved samples, newest first. */
export async function listSamples(page: number): Promise<{ items: SavedSample[]; totalPages: number }> {
  const user = await getCurrentUser()
  const pb = createPocketBase(await requireToken())
  const result = await pb.collection("samples").getList(page, PAGE_SIZE, {
    filter: pb.filter("owner = {:owner}", { owner: user.id }),
    sort: "-created",
    fields: "id,text,language,model,seed,duration_s,note,created,expand.speaker.name",
    expand: "speaker",
  })
  return {
    totalPages: result.totalPages,
    items: result.items.map((r) => ({
      id: r.id,
      text: r.text,
      language: r.language,
      model: r.model,
      seed: r.seed,
      duration_s: r.duration_s,
      note: r.note,
      created: r.created,
      speakerName: r.expand?.speaker?.name ?? null,
    })),
  }
}

// most samples one export can contain; the table shows PAGE_SIZE per page
export const MAX_EXPORT = 1000

const SAMPLE_COLUMNS = [
  "file", "id", "created", "model", "model_name", "language", "language_name", "speaker", "speaker_id",
  "speaker_file", "text", "ref_text", "seed", "duration_s", "checkpoint", "rating", "tags", "note", "job_id",
  "sample_index",
] as const

const SPEAKER_COLUMNS = ["file", "id", "name", "consent", "created"] as const

type CsvValue = string | number | boolean | string[] | null
type SampleRow = Record<(typeof SAMPLE_COLUMNS)[number], CsvValue>
type SpeakerRow = Record<(typeof SPEAKER_COLUMNS)[number], CsvValue>

function csvField(value: CsvValue): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "")
  return `"${text.replaceAll('"', '""')}"`
}

// with a byte order mark, so spreadsheet apps read the dialect names as UTF-8
function toCsv<C extends string>(columns: readonly C[], rows: Record<C, CsvValue>[]): string {
  return "\uFEFF" + [columns.join(","), ...rows.map((row) => columns.map((c) => csvField(row[c])).join(","))].join("\r\n") + "\r\n"
}

/**
 * A zip of the user's samples with these ids (others are skipped): the audio under audio/, the
 * reference recordings of their speakers under speakers/, and all metadata and notes in
 * metadata.csv/.json and speakers.csv/.json. Audio is streamed from PocketBase one file at a
 * time, so large exports don't have to fit in memory.
 * Returns null if none of the samples exist.
 */
export async function exportSamples(token: string, userId: string, ids: string[]): Promise<ReadableStream<Uint8Array> | null> {
  const pb = createPocketBase(token)
  const records: RecordModel[] = []
  // keeps the filter short; access rules only return the user's own samples anyway
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const idFilter = chunk.map((_, j) => `id = {:id${j}}`).join(" || ")
    records.push(...await pb.collection("samples").getFullList({
      filter: pb.filter(`owner = {:owner} && (${idFilter})`, { owner: userId, ...Object.fromEntries(chunk.map((id, j) => [`id${j}`, id])) }),
      expand: "speaker",
    }))
  }
  if (!records.length) {
    return null
  }
  records.sort((a, b) => b.created.localeCompare(a.created))

  // each speaker once, even if several samples were generated from it
  const speakers = new Map<string, RecordModel>()
  for (const r of records) {
    const speaker: RecordModel | undefined = r.expand?.speaker
    if (speaker) speakers.set(speaker.id, speaker)
  }
  const speakerFile = (speaker: RecordModel) => `speakers/${speaker.id}.wav`

  // model and dialect names, if the gateway is reachable
  const models = await getModels(token)
  const modelList = "error" in models ? [] : models
  const modelNames = new Map(modelList.map((m) => [m.id, m.name] as const))
  const languageNames = new Map(modelList.flatMap((m) => m.languages.map((l) => [`${m.id}/${l.code}`, l.name] as const)))

  const sampleRows: SampleRow[] = records.map((r) => {
    const speaker: RecordModel | undefined = r.expand?.speaker
    return {
      file: `audio/${r.id}.wav`,
      id: r.id,
      created: r.created,
      model: r.model,
      model_name: modelNames.get(r.model) ?? null,
      language: r.language,
      language_name: languageNames.get(`${r.model}/${r.language}`) ?? null,
      speaker: speaker?.name ?? null,
      speaker_id: speaker?.id ?? null,
      speaker_file: speaker ? speakerFile(speaker) : null,
      text: r.text,
      ref_text: r.ref_text || null,
      seed: r.seed,
      duration_s: r.duration_s,
      checkpoint: r.checkpoint || null,
      rating: r.rating || null,
      tags: Array.isArray(r.tags) ? r.tags : null,
      note: r.note || null,
      job_id: r.job_id,
      sample_index: r.sample_index,
    }
  })
  const speakerRows: SpeakerRow[] = [...speakers.values()].map((s) => ({
    file: speakerFile(s),
    id: s.id,
    name: s.name || null,
    consent: s.consent,
    created: s.created,
  }))

  // protected files need a short-lived file token
  const fileToken = await pb.files.getToken()

  return new ReadableStream({
    async start(controller) {
      const zip = new Zip((error, chunk, final) => {
        if (error) {
          controller.error(error)
          return
        }
        controller.enqueue(chunk)
        if (final) controller.close()
      })
      const addText = (name: string, text: string) => {
        const file = new ZipDeflate(name, { level: 6 })
        zip.add(file)
        file.push(new TextEncoder().encode(text), true)
      }
      const addAudio = async (name: string, record: RecordModel) => {
        const response = await fetch(pb.files.getURL(record, record.audio, { token: fileToken }), { cache: "no-store" })
        if (!response.ok || !response.body) {
          throw new Error(`loading ${record.collectionName}/${record.id}/audio failed with ${response.status}`)
        }
        // WAV barely compresses, so it is stored as is
        const file = new ZipPassThrough(name)
        file.mtime = new Date(record.created)
        zip.add(file)
        const reader = response.body.getReader()
        for (let read = await reader.read(); !read.done; read = await reader.read()) {
          file.push(read.value)
        }
        file.push(new Uint8Array(0), true)
      }
      try {
        addText("metadata.csv", toCsv(SAMPLE_COLUMNS, sampleRows))
        addText("metadata.json", JSON.stringify(sampleRows, null, 2) + "\n")
        if (speakers.size) {
          addText("speakers.csv", toCsv(SPEAKER_COLUMNS, speakerRows))
          addText("speakers.json", JSON.stringify(speakerRows, null, 2) + "\n")
        }
        for (const record of records) {
          await addAudio(`audio/${record.id}.wav`, record)
        }
        for (const speaker of speakers.values()) {
          await addAudio(speakerFile(speaker), speaker)
        }
        zip.end()
      } catch (e) {
        console.error("exporting samples failed", e)
        zip.terminate()
        controller.error(e)
      }
    },
  })
}
