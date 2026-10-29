// Cookie and token helpers shared by the proxy and server code (no next/headers here,
// because the proxy works on the request and response objects instead).
import { getTokenPayload, isTokenExpired } from "pocketbase"

export const AUTH_COOKIE = "pb_auth"

// refresh the token when less than this is left (PocketBase issues tokens for 5 days by default)
export const REFRESH_BEFORE_SECONDS = 2 * 24 * 60 * 60

export function isTokenValid(token: string | undefined): token is string {
  return !!token && !isTokenExpired(token)
}

export function tokenUserId(token: string): string | undefined {
  return getTokenPayload(token).id
}

export function secondsUntilExpiry(token: string): number {
  const { exp } = getTokenPayload(token)
  return typeof exp === "number" ? exp - Date.now() / 1000 : 0
}

// httpOnly keeps the token away from page scripts; the cookie expires together with the token
export function authCookieOptions(token: string) {
  const { exp } = getTokenPayload(token)
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: typeof exp === "number" ? new Date(exp * 1000) : undefined,
  }
}
