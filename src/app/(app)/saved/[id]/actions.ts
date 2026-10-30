"use server"

import { revalidatePath } from "next/cache"
import { ClientResponseError } from "pocketbase"
import { type ErrorCounts, ERROR_KEYS, MAX_ERROR_COUNT, normalizeErrors } from "@/lib/annotations"
import { requireToken } from "@/lib/auth"
import { isRecordId } from "@/lib/files"
import { createPocketBase } from "@/lib/pocketbase"

// access rules only allow changes to the user's own samples; the Saved page shows annotations,
// so its cached copy in the browser is invalidated
async function updateSample<T>(id: string, data: Record<string, unknown>, fields: string, read: (record: Record<string, unknown>) => T): Promise<T | { error: string }> {
  if (!isRecordId(id)) {
    return { error: "Unknown sample." }
  }
  try {
    const record = await createPocketBase(await requireToken()).collection("samples").update(id, data, { fields })
    revalidatePath("/saved")
    return read(record)
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 404) {
      return { error: "This sample no longer exists." }
    }
    console.error("saving an annotation failed", e)
    return { error: "Saving failed. Try again later." }
  }
}

export async function saveErrors(id: string, errors: ErrorCounts): Promise<{ errors: ErrorCounts } | { error: string }> {
  const valid = errors && typeof errors === "object" && ERROR_KEYS.every((key) => {
    const n = errors[key]
    return Number.isInteger(n) && n >= 0 && n <= MAX_ERROR_COUNT
  })
  if (!valid) {
    return { error: `Counts must be whole numbers from 0 to ${MAX_ERROR_COUNT}.` }
  }
  return updateSample(id, { errors: normalizeErrors(errors) }, "errors", (r) => ({ errors: normalizeErrors(r.errors) }))
}

export async function saveDieth(id: string, dieth: string): Promise<{ dieth: string } | { error: string }> {
  const trimmed = dieth.trim()
  if (trimmed.length > 5000) {
    return { error: "The transcript can be at most 5000 characters long." }
  }
  return updateSample(id, { dieth: trimmed }, "dieth", (r) => ({ dieth: String(r.dieth ?? "") }))
}
