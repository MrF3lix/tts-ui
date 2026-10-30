import { Suspense } from "react"
import type { Metadata } from "next"
import { Card } from "@/components/ui/card"
import { requireToken } from "@/lib/auth"
import { getModels } from "@/lib/gateway"
import { listSamples } from "@/lib/samples"
import { ExportSelectionProvider, ExportToolbar, SampleCount } from "./export-selection"
import { SampleList } from "./sample-list"

export const metadata: Metadata = {
  title: "Saved samples · TTS",
}

export default function SavedPage() {
  return (
    <ExportSelectionProvider>
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">Saved samples</h1>
            <p className="text-sm text-muted-foreground">Samples you kept on the generate page. They stay until you remove them.</p>
            <SampleCount />
          </div>
          <ExportToolbar />
        </div>
        <Suspense fallback={<Card className="h-64 animate-pulse" />}>
          <SampleTable />
        </Suspense>
      </div>
    </ExportSelectionProvider>
  )
}

async function SampleTable() {
  const [{ items, total, next }, models] = await Promise.all([listSamples(), getModels(await requireToken())])

  // model and dialect names come from the models; ids and codes are shown while the gateway is unreachable
  const modelList = "error" in models ? [] : models
  const modelNames = Object.fromEntries(modelList.map((m) => [m.id, m.name]))
  const languageNames = Object.fromEntries(modelList.flatMap((m) => m.languages.map((l) => [`${m.id}/${l.code}`, l.name])))

  return (
    <SampleList
      initialItems={items}
      initialNext={next}
      initialTotal={total ?? items.length}
      modelNames={modelNames}
      languageNames={languageNames}
    />
  )
}
