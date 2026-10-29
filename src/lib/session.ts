import "server-only"
import { cookies } from "next/headers"
import { AUTH_COOKIE, authCookieOptions } from "@/lib/auth-token"

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(AUTH_COOKIE)?.value
}

// only callable from server actions and route handlers
export async function setSession(token: string) {
  (await cookies()).set(AUTH_COOKIE, token, authCookieOptions(token))
}

export async function clearSession() {
  (await cookies()).delete(AUTH_COOKIE)
}
