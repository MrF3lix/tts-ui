import "server-only"
import { ClientResponseError } from "pocketbase"
import { isTokenValid, tokenUserId } from "@/lib/auth-token"
import { createPocketBase } from "@/lib/pocketbase"
import { getToken } from "@/lib/session"
import type { Health, ModelInfo } from "@/lib/tts"

// headers of gateway responses that clients need (content type, polling hints, SSE behaviour)
const PASS_HEADERS = ["content-type", "content-length", "retry-after", "cache-control", "x-accel-buffering"]

// tokens checked against PocketBase recently, with the time until which they count as checked;
// saves a round trip on every progress update and audio request
const verified = new Map<string, number>()
const VERIFY_TTL_MS = 60_000

function apiUrl(path: string): URL {
  const base = process.env.API_URL
  if (!base) {
    throw new Error("API_URL is not set")
  }
  return new URL(path, base)
}

/** The request's PocketBase token if it belongs to an existing user, otherwise null. */
export async function verifiedToken(): Promise<string | null> {
  const token = await getToken()
  if (!isTokenValid(token)) {
    return null
  }
  const now = Date.now()
  if ((verified.get(token) ?? 0) > now) {
    return token
  }
  const id = tokenUserId(token)
  if (!id) {
    return null
  }
  try {
    await createPocketBase(token).collection("users").getOne(id, { fields: "id" })
  } catch (e) {
    if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) {
      return null
    }
    throw e
  }
  if (verified.size > 1000) {
    for (const [t, until] of verified) {
      if (until <= now) verified.delete(t)
    }
  }
  verified.set(token, now + VERIFY_TTL_MS)
  return token
}

/**
 * Forwards a route handler's request to the gateway on behalf of the signed-in user and
 * streams the response back (JSON, audio or the SSE progress stream) with its status code.
 */
export async function forward(
  request: Request,
  path: string,
  { body, headers: extra }: { body?: BodyInit | null; headers?: Record<string, string> } = {},
): Promise<Response> {
  const token = await verifiedToken()
  if (!token) {
    return Response.json({ detail: "Not signed in" }, { status: 401 })
  }

  const headers = new Headers({ Authorization: token })
  const contentType = request.headers.get("content-type")
  // FormData bodies get their own content type (with a new multipart boundary) from fetch
  if (body && contentType && !(body instanceof FormData)) {
    headers.set("content-type", contentType)
  }

  let upstream: Response
  try {
    upstream = await fetch(apiUrl(path), {
      method: request.method,
      headers,
      body,
      // stream request bodies (speaker uploads) instead of buffering them
      ...(body ? { duplex: "half" } : {}),
      // stops the gateway's work, e.g. the progress stream, when the browser goes away
      signal: request.signal,
      cache: "no-store",
    } as RequestInit)
  } catch (e) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 })
    }
    console.error(`gateway request ${request.method} ${path} failed`, e)
    return Response.json({ detail: "The TTS service is not reachable. Try again later." }, { status: 502 })
  }

  // extra headers (caching, downloads) only apply to successful responses
  const out = new Headers(upstream.ok ? extra : undefined)
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name)
    // fetch decompresses bodies, so a compressed length would be wrong
    if (value && !out.has(name) && !(name === "content-length" && upstream.headers.has("content-encoding"))) {
      out.set(name, value)
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers: out })
}

/** A request to the gateway made by the server itself on the user's behalf. */
export function fetchGateway(token: string, path: string): Promise<Response> {
  return fetch(apiUrl(path), { headers: { Authorization: token }, cache: "no-store" })
}

/** Models with registered workers, for rendering the form on the server. */
export async function getModels(token: string): Promise<ModelInfo[] | { error: string }> {
  try {
    const response = await fetchGateway(token, "/models")
    if (!response.ok) {
      return { error: `The TTS service answered with ${response.status}.` }
    }
    return await response.json()
  } catch (e) {
    console.error("loading models failed", e)
    return { error: "The TTS service is not reachable." }
  }
}

type HealthCheck = { checkedAt: number } & ({ health: Health; latencyMs: number } | { error: string })

/** The gateway's health with the round trip time, or why it could not be read. */
export async function getHealth(token: string): Promise<HealthCheck> {
  const start = performance.now()
  try {
    const response = await fetchGateway(token, "/health")
    if (!response.ok) {
      return { error: `The TTS service answered with ${response.status}.`, checkedAt: Date.now() }
    }
    const health: Health = await response.json()
    return { health, latencyMs: Math.round(performance.now() - start), checkedAt: Date.now() }
  } catch (e) {
    console.error("loading health failed", e)
    return { error: "The TTS service is not reachable.", checkedAt: Date.now() }
  }
}

// job ids are hex uuids; checking them keeps paths like "../models" out of gateway URLs
export function isJobId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id)
}

export function notFound(): Response {
  return Response.json({ detail: "Not found" }, { status: 404 })
}
