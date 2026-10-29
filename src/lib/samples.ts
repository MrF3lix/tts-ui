import "server-only"
import { ClientResponseError } from "pocketbase"
import { getCurrentUser, requireToken } from "@/lib/auth"
import { fetchGateway } from "@/lib/gateway"
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
