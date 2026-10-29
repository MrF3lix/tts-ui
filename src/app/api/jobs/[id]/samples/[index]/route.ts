import { forward, isJobId, notFound } from "@/lib/gateway"

// ?download=1 makes the browser save the file instead of playing it
export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]/samples/[index]">) {
  const { id, index } = await ctx.params
  if (!isJobId(id) || !/^\d{1,2}$/.test(index)) {
    return notFound()
  }
  const download = new URL(request.url).searchParams.has("download")
  return forward(request, `/jobs/${id}/samples/${index}.wav`, {
    headers: {
      "cache-control": "private, max-age=86400",
      ...(download ? { "content-disposition": `attachment; filename="tts-${id.slice(0, 8)}-${index}.wav"` } : {}),
    },
  })
}
