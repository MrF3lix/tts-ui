import { forward, isJobId, notFound } from "@/lib/gateway"

// Server-Sent Events, streamed through as they arrive
export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]/events">) {
  const { id } = await ctx.params
  return isJobId(id) ? forward(request, `/jobs/${id}/events`) : notFound()
}
