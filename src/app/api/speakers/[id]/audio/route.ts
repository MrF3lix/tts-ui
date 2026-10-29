import { verifiedToken } from "@/lib/gateway"
import { fileResponse } from "@/lib/files"
import { speakerAudio } from "@/lib/speakers"

// the reference recording of a speaker, for preview players
export async function GET(_request: Request, ctx: RouteContext<"/api/speakers/[id]/audio">) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const { id } = await ctx.params
  const audio = await speakerAudio(token, id)
  if (!audio) {
    return Response.json({ detail: "Not found" }, { status: 404 })
  }
  return fileResponse(audio)
}
