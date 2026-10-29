import "server-only"
import PocketBase, { ClientResponseError } from "pocketbase"

// PocketBase record ids: 15 lowercase letters and digits
export function isRecordId(id: string): boolean {
  return /^[a-z0-9]{15}$/.test(id)
}

/**
 * Downloads a protected file of a record the user can view, or returns null if there is no
 * such record (access rules hide other users' records).
 */
export async function protectedFile(pb: PocketBase, collection: string, id: string, field: string): Promise<Response | null> {
  if (!isRecordId(id)) {
    return null
  }
  let record
  try {
    record = await pb.collection(collection).getOne(id, { fields: `id,collectionId,collectionName,${field}` })
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 404) return null
    throw e
  }
  // protected files need a short-lived file token
  const token = await pb.files.getToken()
  const response = await fetch(pb.files.getURL(record, record[field], { token }), { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`loading ${collection}/${id}/${field} failed with ${response.status}`)
  }
  return response
}

/** Streams a file to the browser; files of saved records never change. */
export function fileResponse(file: Response, filename?: string): Response {
  const headers = new Headers({
    "content-type": file.headers.get("content-type") ?? "audio/wav",
    "cache-control": "private, max-age=86400",
  })
  const length = file.headers.get("content-length")
  if (length) headers.set("content-length", length)
  if (filename) headers.set("content-disposition", `attachment; filename="${filename}"`)
  return new Response(file.body, { headers })
}
