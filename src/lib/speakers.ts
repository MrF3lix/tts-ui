import "server-only"
import { createHash } from "node:crypto"
import { ClientResponseError } from "pocketbase"
import { getCurrentUser, requireToken } from "@/lib/auth"
import { protectedFile } from "@/lib/files"
import { createPocketBase } from "@/lib/pocketbase"

export type Speaker = {
  id: string
  name: string
  created: string
}

const FIELDS = "id,name,created"

/** The signed-in user's speakers, newest first. */
export async function listSpeakers(): Promise<Speaker[]> {
  const user = await getCurrentUser()
  const pb = createPocketBase(await requireToken())
  return pb.collection("speakers").getFullList<Speaker>({
    filter: pb.filter("owner = {:owner}", { owner: user.id }),
    sort: "-created",
    fields: FIELDS,
  })
}

/**
 * The speaker with this reference recording, created if the user doesn't have it yet.
 * Recordings are matched by the SHA-256 of the WAV file as stored (the browser's 16-bit mono
 * conversion), so uploading the same file again finds the existing speaker.
 */
export async function findOrCreateSpeaker(token: string, userId: string, audio: Blob, name: string): Promise<Speaker> {
  const bytes = Buffer.from(await audio.arrayBuffer())
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const pb = createPocketBase(token)
  const filter = pb.filter("owner = {:owner} && sha256 = {:sha256}", { owner: userId, sha256 })

  const existing = await pb.collection("speakers").getList<Speaker>(1, 1, { filter, fields: FIELDS })
  if (existing.items.length) {
    return existing.items[0]
  }
  try {
    return await pb.collection("speakers").create<Speaker>({
      owner: userId,
      name: name.trim().slice(0, 200) || "Unnamed speaker",
      sha256,
      audio: new File([bytes], "reference.wav", { type: "audio/wav" }),
    }, { fields: FIELDS })
  } catch (e) {
    // the same recording was saved concurrently (unique index on owner + sha256)
    if (e instanceof ClientResponseError && e.status === 400) {
      const again = await pb.collection("speakers").getList<Speaker>(1, 1, { filter, fields: FIELDS })
      if (again.items.length) return again.items[0]
    }
    throw e
  }
}

/** The reference recording of one of the user's speakers, or null if there is no such speaker. */
export async function speakerAudio(token: string, id: string): Promise<Response | null> {
  return protectedFile(createPocketBase(token), "speakers", id, "audio")
}
