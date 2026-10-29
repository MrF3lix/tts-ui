"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const INTERVAL_MS = 10_000

/** Re-renders the server page periodically (while the tab is visible) and on demand. */
export function AutoRefresh({ checkedAt }: { checkedAt: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(checkedAt)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") {
        startTransition(() => router.refresh())
      }
    }, INTERVAL_MS)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
    }
  }, [router])

  const seconds = Math.max(0, Math.round((now - checkedAt) / 1000))
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Checked {seconds < 2 ? "just now" : `${seconds}s ago`}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        Refresh
      </Button>
    </div>
  )
}
