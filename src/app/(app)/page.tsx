import { Suspense } from "react"
import type { Metadata } from "next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { GenerateView } from "@/components/generate/generate-view"
import { getCurrentUser, requireToken } from "@/lib/auth"
import { getModels } from "@/lib/gateway"
import { listSpeakers } from "@/lib/speakers"

export const metadata: Metadata = {
  title: "Generate · TTS",
}

export default function GeneratePage() {
  return (
    <div className="mx-auto grid gap-6">
      <h1 className="text-xl font-semibold">Generate speech</h1>
      <Suspense fallback={<Card className="h-[32rem] animate-pulse" />}>
        <Generate />
      </Suspense>
    </div>
  )
}

async function Generate() {
  const user = await getCurrentUser()
  const [models, speakers] = await Promise.all([getModels(await requireToken()), listSpeakers()])

  if ("error" in models) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Generation is unavailable</AlertTitle>
        <AlertDescription>{models.error} Try again later.</AlertDescription>
      </Alert>
    )
  }
  if (models.length === 0) {
    return (
      <Alert>
        <AlertTitle>No models available</AlertTitle>
        <AlertDescription>No TTS worker has started yet. Try again in a few minutes.</AlertDescription>
      </Alert>
    )
  }
  return <GenerateView models={models} speakers={speakers} userId={user.id} />
}
