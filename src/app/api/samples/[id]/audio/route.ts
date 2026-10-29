import { fileResponse, protectedFile } from "@/lib/files"
import { verifiedToken } from "@/lib/gateway"
import { createPocketBase } from "@/lib/pocketbase"

// a saved sample's audio; ?download=1 makes the browser save it
export async function GET(request: Request, ctx: RouteContext<"/api/samples/[id]/audio">) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const { id } = await ctx.params
  // access rules only return the user's own samples
  const audio = await protectedFile(createPocketBase(token), "samples", id, "audio")
  if (!audio) {
    return Response.json({ detail: "Not found" }, { status: 404 })
  }
  const download = new URL(request.url).searchParams.has("download")
  return fileResponse(audio, download ? `tts-sample-${id}.wav` : undefined)
}
