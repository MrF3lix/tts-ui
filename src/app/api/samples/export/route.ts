import { tokenUserId } from "@/lib/auth-token"
import { isRecordId } from "@/lib/files"
import { verifiedToken } from "@/lib/gateway"
import { MAX_EXPORT, exportSamples } from "@/lib/samples"

// a zip of the signed-in user's samples: body {"ids": ["...", ...]}
export async function POST(request: Request) {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : []
  if (!ids.length || !ids.every((id) => typeof id === "string" && isRecordId(id))) {
    return Response.json({ detail: "Select the samples to export." }, { status: 400 })
  }
  if (ids.length > MAX_EXPORT) {
    return Response.json({ detail: `At most ${MAX_EXPORT} samples can be exported at once.` }, { status: 400 })
  }

  let zip
  try {
    zip = await exportSamples(token, tokenUserId(token)!, ids as string[])
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
