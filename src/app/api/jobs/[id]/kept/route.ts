import { tokenUserId } from "@/lib/auth-token"
import { isJobId, notFound, verifiedToken } from "@/lib/gateway"
import { keptIndices } from "@/lib/samples"

// indices of the job's samples the user has kept
export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[id]/kept">) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const { id } = await ctx.params
  return isJobId(id) ? Response.json(await keptIndices(token, tokenUserId(token)!, id)) : notFound()
}
