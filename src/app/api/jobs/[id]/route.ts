import { forward, isJobId, notFound } from "@/lib/gateway"

export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params
  return isJobId(id) ? forward(request, `/jobs/${id}`) : notFound()
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params
  return isJobId(id) ? forward(request, `/jobs/${id}`) : notFound()
}
