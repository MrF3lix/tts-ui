"use server"

import { ClientResponseError } from "pocketbase"
import { requireToken } from "@/lib/auth"
import { isRecordId } from "@/lib/files"
import { createPocketBase } from "@/lib/pocketbase"
import { type SampleCursor, type SavedSample, listSamples } from "@/lib/samples"

export type NoteResult = { note: string } | { error: string }

export async function saveNote(id: string, note: string): Promise<NoteResult> {
  const trimmed = note.trim()
  if (trimmed.length > 5000) {
    return { error: "Notes can be at most 5000 characters long." }
  }
  if (!isRecordId(id)) {
    return { error: "Unknown sample." }
  }
  try {
    // access rules only allow notes on the user's own samples
    const record = await createPocketBase(await requireToken())
      .collection("samples").update(id, { note: trimmed }, { fields: "note" })
    return { note: record.note }
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 404) {
      return { error: "This sample no longer exists." }
    }
    console.error("saving a note failed", e)
    return { error: "Saving failed. Try again later." }
  }
}

export async function deleteSample(id: string): Promise<{ error?: string }> {
  if (!isRecordId(id)) {
    return { error: "Unknown sample." }
  }
  try {
    // access rules only allow deleting the user's own samples
    await createPocketBase(await requireToken()).collection("samples").delete(id)
    return {}
  } catch (e) {
    // already gone: the result is the same
    if (e instanceof ClientResponseError && e.status === 404) {
      return {}
    }
    console.error("deleting a sample failed", e)
    return { error: "Deleting failed. Try again later." }
  }
}

/** The next page of saved samples, for loading more while scrolling. */
export async function loadMoreSamples(cursor: SampleCursor): Promise<{ items: SavedSample[]; next: SampleCursor | null } | { error: string }> {
  if (typeof cursor?.created !== "string" || !/^[\d-]+ [\d:.]+Z$/.test(cursor.created) || typeof cursor.id !== "string" || !isRecordId(cursor.id)) {
    return { error: "Invalid position." }
  }
  try {
    const { items, next } = await listSamples({ created: cursor.created, id: cursor.id })
    return { items, next }
  } catch (e) {
    console.error("loading samples failed", e)
    return { error: "Loading more samples failed." }
  }
}
