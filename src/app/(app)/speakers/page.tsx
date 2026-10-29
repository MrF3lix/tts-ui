import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { listSpeakers } from "@/lib/speakers"
import { SpeakerRow } from "./speaker-row"

export const metadata: Metadata = {
  title: "Speakers · TTS",
}

export default function SpeakersPage() {
  return (
    <div className="mx-auto grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Speakers</h1>
        <p className="text-sm text-muted-foreground">
          Reference recordings are saved here when you generate with them, and can be picked again on the generate page.
        </p>
      </div>
      <Suspense fallback={<Card className="h-48 animate-pulse" />}>
        <SpeakerList />
      </Suspense>
    </div>
  )
}

async function SpeakerList() {
  const speakers = await listSpeakers()
  if (speakers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No speakers yet. <Link href="/" className="underline underline-offset-4">Generate</Link> with a recording to add one.
      </p>
    )
  }
  return (
    <ul className="grid gap-3">
      {speakers.map((speaker) => <SpeakerRow key={speaker.id} speaker={speaker} />)}
    </ul>
  )
}
