import { type ReactNode, Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { LocalTime } from "@/components/local-time"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { requireToken } from "@/lib/auth"
import { getModels } from "@/lib/gateway"
import { getAnnotatedSample } from "@/lib/samples"
import { NoteField } from "../note-field"
import { DiethField } from "./dieth-field"
import { ErrorAnnotation } from "./error-annotation"

export const metadata: Metadata = {
  title: "Annotate sample · TTS",
}

export default function AnnotatePage({ params }: PageProps<"/saved/[id]">) {
  return (
    <div className="grid min-w-0 gap-6">
      <Link href="/saved" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Saved samples
      </Link>
      <Suspense fallback={<Card className="h-96 animate-pulse" />}>
        <Annotation params={params} />
      </Suspense>
    </div>
  )
}

async function Annotation({ params }: Pick<PageProps<"/saved/[id]">, "params">) {
  const { id } = await params
  const [result, models] = await Promise.all([getAnnotatedSample(id), getModels(await requireToken())])
  if (!result) {
    notFound()
  }
  const { sample, older, newer } = result

  // display names come from the models; ids and codes are shown while the gateway is unreachable
  const model = "error" in models ? undefined : models.find((m) => m.id === sample.model)
  const language = model?.languages.find((l) => l.code === sample.language)

  const details: [string, ReactNode][] = [
    ["Model", model?.name ?? sample.model],
    ["Dialect", language?.name ?? sample.language],
    ["Speaker", sample.speakerName ?? "Unknown speaker"],
    ["Seed", sample.seed],
    ["Duration", `${sample.duration_s.toFixed(1)} s`],
    ["Saved", <LocalTime key="saved" value={sample.created} />],
    ...(sample.checkpoint ? [["Checkpoint", sample.checkpoint] as [string, string]] : []),
  ]

  return (
    // remounted per sample, so the autosaving fields start from the new sample's values
    <div key={sample.id} className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Annotate sample</h1>
        <nav className="flex items-center gap-2" aria-label="Other samples">
          <NeighbourLink id={newer} label="Newer" icon="previous" />
          <NeighbourLink id={older} label="Older" icon="next" />
        </nav>
      </div>

      <Card>
        <CardContent className="grid gap-4">
          <p className="text-base">{sample.text}</p>
          <audio controls preload="metadata" src={`/api/samples/${sample.id}/audio`} className="w-full" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            {details.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {sample.ref_text && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Reference text:</span> {sample.ref_text}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor="dieth">Transcript (Dieth spelling)</Label>
          <DiethField id={sample.id} initial={sample.dieth} />
        </div>
        <div className="grid content-start gap-2">
          <Label>Notes</Label>
          <NoteField id={sample.id} initial={sample.note} />
        </div>
      </div>

      <ErrorAnnotation id={sample.id} initial={sample.errors} annotated={sample.annotated} />
    </div>
  )
}

function NeighbourLink({ id, label, icon }: { id: string | null; label: string; icon: "previous" | "next" }) {
  const content = icon === "previous" ? <><ChevronLeftIcon /> {label}</> : <>{label} <ChevronRightIcon /></>
  if (!id) {
    return <Button variant="outline" size="sm" disabled>{content}</Button>
  }
  return (
    <Link href={`/saved/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{content}</Link>
  )
}
