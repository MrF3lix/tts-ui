"use client"

import { useSyncExternalStore } from "react"

const pad = (n: number) => String(n).padStart(2, "0")

const subscribe = () => () => {}

/**
 * A PocketBase timestamp ("2026-10-30 12:29:48.245Z") as "2026-10-30 13:29" in the browser's
 * time zone. The server doesn't know that zone, so it renders UTC, which the browser replaces
 * after hydrating.
 */
export function LocalTime({ value }: { value: string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const iso = value.replace(" ", "T")
  const date = new Date(iso)
  if (!hydrated || Number.isNaN(date.getTime())) {
    return <time dateTime={iso}>{value.slice(0, 16)}</time>
  }
  const text = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return <time dateTime={iso} title={date.toString()}>{text}</time>
}
