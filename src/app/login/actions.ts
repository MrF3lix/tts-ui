"use server"

import { redirect } from "next/navigation"
import { ClientResponseError } from "pocketbase"
import { createPocketBase } from "@/lib/pocketbase"
import { setSession } from "@/lib/session"

export type LoginState = {
  error?: string
  email?: string
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const next = safeRedirect(formData.get("next"))
  if (!email || !password) {
    return { error: "Enter your email and password.", email }
  }

  const pb = createPocketBase()
  try {
    await pb.collection("users").authWithPassword(email, password)
  } catch (e) {
    if (e instanceof ClientResponseError && e.status === 400) {
      return { error: "Wrong email or password.", email }
    }
    if (e instanceof ClientResponseError && e.status === 429) {
      return { error: "Too many attempts. Wait a moment and try again.", email }
    }
    console.error("login failed", e)
    return { error: "Signing in is not possible right now. Try again later.", email }
  }

  await setSession(pb.authStore.token)
  redirect(next)
}

// only same-site paths, so a crafted link can't send the user elsewhere after login
function safeRedirect(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : ""
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/"
}
