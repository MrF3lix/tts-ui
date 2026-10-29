import { forward, verifiedToken } from "@/lib/gateway"
import { findOrCreateSpeaker, speakerAudio } from "@/lib/speakers"
import { tokenUserId } from "@/lib/auth-token"

/**
 * Submits a job. The reference is either a saved speaker (speaker_id), whose recording is
 * loaded from PocketBase, or a new recording (speaker_wav), which is saved as a speaker once
 * the gateway accepts the job. The response carries the speaker's id in X-Speaker-Id.
 *
 * A route handler rather than a server action: server actions limit bodies to 1 MB by default.
 */
export async function POST(request: Request) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ detail: "Expected a multipart form" }, { status: 400 })
  }

  const speakerId = form.get("speaker_id")
  form.delete("speaker_id")
  if (typeof speakerId === "string" && speakerId) {
    const audio = await speakerAudio(token, speakerId)
    if (!audio) {
      return Response.json({ detail: "This speaker no longer exists." }, { status: 404 })
    }
    form.set("speaker_wav", await audio.blob(), "reference.wav")
  }

  const response = await forward(request, "/jobs", { body: form })

  const upload = form.get("speaker_wav")
  if (response.ok && !speakerId && upload instanceof File) {
    try {
      const speaker = await findOrCreateSpeaker(token, tokenUserId(token)!, upload, upload.name.replace(/\.wav$/i, ""))
      response.headers.set("x-speaker-id", speaker.id)
    } catch (e) {
      // the job is running anyway; the speaker just isn't saved
      console.error("saving the speaker failed", e)
    }
  } else if (response.ok && typeof speakerId === "string" && speakerId) {
    response.headers.set("x-speaker-id", speakerId)
  }
  return response
}
