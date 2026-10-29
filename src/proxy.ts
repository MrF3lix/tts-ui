import { NextResponse, type NextRequest } from "next/server"
import PocketBase, { ClientResponseError } from "pocketbase"
import {
  AUTH_COOKIE, REFRESH_BEFORE_SECONDS, authCookieOptions, isTokenValid, secondsUntilExpiry,
} from "@/lib/auth-token"

const PUBLIC_PATHS = ["/login"]

// Optimistic check only: redirects visitors without a valid-looking token to /login and
// refreshes tokens that are about to expire. Pages still verify the user (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!isTokenValid(token)) {
    return toLogin(request, pathname + search)
  }

  if (secondsUntilExpiry(token) < REFRESH_BEFORE_SECONDS) {
    const pb = new PocketBase(process.env.PB_URL)
    pb.authStore.save(token)
    try {
      await pb.collection("users").authRefresh()
      const response = NextResponse.next()
      response.cookies.set(AUTH_COOKIE, pb.authStore.token, authCookieOptions(pb.authStore.token))
      return response
    } catch (e) {
      if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) {
        return toLogin(request, pathname + search)
      }
      // PocketBase unreachable: the token is still valid, try again on the next request
    }
  }
  return NextResponse.next()
}

function toLogin(request: NextRequest, next: string) {
  const url = new URL("/login", request.url)
  if (next !== "/") {
    url.searchParams.set("next", next)
  }
  const response = NextResponse.redirect(url)
  response.cookies.delete(AUTH_COOKIE)
  return response
}

export const config = {
  // route handlers under /api answer 401 themselves instead of redirecting
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
}
