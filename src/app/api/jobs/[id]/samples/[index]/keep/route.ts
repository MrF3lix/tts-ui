import { tokenUserId } from "@/lib/auth-token"
import { isRecordId } from "@/lib/files"
import { isJobId, notFound, verifiedToken } from "@/lib/gateway"
import { KeepError, keepSample, unkeepSample } from "@/lib/samples"

type Ctx = RouteContext<"/api/jobs/[id]/samples/[index]/keep">

async function params(ctx: Ctx) {
  const { id, index } = await ctx.params
  return isJobId(id) && /^\d{1,2}$/.test(index) ? { id, index: Number(index) } : null
}

// keeps a sample: body {"speaker_id": "..."} links it to the speaker the job used
export async function POST(request: Request, ctx: Ctx) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const p = await params(ctx)
  if (!p) {
    return notFound()
  }
  const body = await request.json().catch(() => ({}))
  const speakerId = typeof body.speaker_id === "string" && isRecordId(body.speaker_id) ? body.speaker_id : null
  try {
    const id = await keepSample(token, tokenUserId(token)!, p.id, p.index, speakerId)
    return Response.json({ id })
  } catch (e) {
    if (e instanceof KeepError) {
      return Response.json({ detail: e.message }, { status: e.status })
    }
    console.error("keeping a sample failed", e)
    return Response.json({ detail: "The sample could not be saved. Try again later." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const p = await params(ctx)
  if (!p) {
    return notFound()
  }
  await unkeepSample(token, tokenUserId(token)!, p.id, p.index)
  return new Response(null, { status: 204 })
}
