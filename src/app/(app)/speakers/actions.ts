"use server"

import { ClientResponseError } from "pocketbase"
import { requireToken } from "@/lib/auth"
import { createPocketBase } from "@/lib/pocketbase"
import { isRecordId } from "@/lib/files"

export type RenameResult = { name: string } | { error: string }

export async function renameSpeaker(id: string, name: string): Promise<RenameResult> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: "The name must not be empty." }
  }
  if (trimmed.length > 200) {
    return { error: "The name can be at most 200 characters long." }
  }
  if (!isRecordId(id)) {
    return { error: "Unknown speaker." }
  }
  try {
    // access rules only allow renaming the user's own speakers
    const record = await createPocketBase(await requireToken())
      .collection("speakers").update(id, { name: trimmed }, { fields: "name" })
    return { name: record.name }
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 404) {
      return { error: "This speaker no longer exists." }
    }
    console.error("renaming speaker failed", e)
    return { error: "Saving failed. Try again later." }
  }
}
