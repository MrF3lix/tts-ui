import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { ClientResponseError } from "pocketbase"
import { isTokenValid, tokenUserId } from "@/lib/auth-token"
import { createPocketBase } from "@/lib/pocketbase"
import { getToken } from "@/lib/session"

export type User = {
  id: string
  email: string
  name: string
  role: "user" | "admin"
}

/**
 * The signed-in user, checked against PocketBase; redirects to /login otherwise.
 * Call it wherever user data is read: the proxy only does an optimistic check of the cookie.
 */
export const getCurrentUser = cache(async (): Promise<User> => {
  const token = await getToken()
  // the expiry check reads the clock, which must happen at request time
  await connection()
  if (!isTokenValid(token)) {
    redirect("/login")
  }
  const id = tokenUserId(token)
  if (!id) {
    redirect("/login")
  }

  let record
  try {
    // fails if the token was revoked (password change) or the account was deleted
    record = await createPocketBase(token).collection("users").getOne(id)
  } catch (e) {
    if (e instanceof ClientResponseError && [401, 403, 404].includes(e.status)) {
      redirect("/login")
    }
    throw e
  }
  return {
    id: record.id,
    email: record.email,
    name: record.name || record.email,
    role: record.role === "admin" ? "admin" : "user",
  }
})

/** The PocketBase token of the current request, for calls made on the user's behalf. */
export async function requireToken(): Promise<string> {
  await getCurrentUser()
  return (await getToken())!
}
