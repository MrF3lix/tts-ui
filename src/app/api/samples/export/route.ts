import { tokenUserId } from "@/lib/auth-token"
import { isRecordId } from "@/lib/files"
import { verifiedToken } from "@/lib/gateway"
import { MAX_EXPORT_IDS, type ExportSelection, exportSamples } from "@/lib/samples"

// a zip of the signed-in user's samples: body {"ids": ["...", ...]} for these samples, or
// {"all": true, "exclude": ["...", ...]} for all of them except some (including ones the page hasn't loaded)
export async function POST(request: Request) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const all = body.all === true
  const list = all ? body.exclude ?? [] : body.ids
  const ids = Array.isArray(list) ? [...new Set(list)] : null
  if (!ids || (!all && !ids.length) || !ids.every((id) => typeof id === "string" && isRecordId(id))) {
    return Response.json({ detail: "Select the samples to export." }, { status: 400 })
  }
  if (ids.length > MAX_EXPORT_IDS) {
    return Response.json({ detail: `Select all samples or at most ${MAX_EXPORT_IDS} single ones.` }, { status: 400 })
  }
  const selection: ExportSelection = all ? { allExcept: ids as string[] } : { ids: ids as string[] }

  let zip
  try {
    zip = await exportSamples(token, tokenUserId(token)!, selection)
  } catch (e) {
    console.error("exporting samples failed", e)
    return Response.json({ detail: "The export failed. Try again later." }, { status: 500 })
  }
  if (!zip) {
    return Response.json({ detail: "The selected samples no longer exist." }, { status: 404 })
  }
  const date = new Date().toISOString().slice(0, 10)
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="tts-samples-${date}.zip"`,
      "cache-control": "no-store",
    },
  })
}
