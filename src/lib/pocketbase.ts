import "server-only"
import PocketBase from "pocketbase"

export function createPocketBase(token?: string): PocketBase {
  const url = process.env.PB_URL
  if (!url) {
    throw new Error("PB_URL is not set")
  }
  const pb = new PocketBase(url)
  // one client per request: concurrent calls must not cancel each other
  pb.autoCancellation(false)
  if (token) {
    pb.authStore.save(token)
  }
  return pb
}
