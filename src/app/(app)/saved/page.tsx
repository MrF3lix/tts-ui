import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireToken } from "@/lib/auth"
import { getModels } from "@/lib/gateway"
import { listSamples } from "@/lib/samples"
import { DeleteSampleButton } from "./delete-sample-button"
import { ExpandableText } from "./expandable-text"
import { NoteField } from "./note-field"

export const metadata: Metadata = {
  title: "Saved samples · TTS",
}

const MAX_TEXT = 80

export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Saved samples</h1>
        <p className="text-sm text-muted-foreground">Samples you kept on the generate page. They stay until you remove them.</p>
      </div>
      <Suspense fallback={<Card className="h-64 animate-pulse" />}>
        <SampleTable searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SampleTable({ searchParams }: Pick<PageProps<"/saved">, "searchParams">) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const [{ items, totalPages }, models] = await Promise.all([listSamples(page), getModels(await requireToken())])

  if (items.length === 0 && page === 1) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing saved yet. Use <span className="font-medium">Save</span> on a finished variant on
        the <Link href="/" className="underline underline-offset-4">generate page</Link>.
      </p>
    )
  }

  // model and dialect names come from the models; ids and codes are shown while the gateway is unreachable
  const modelList = "error" in models ? [] : models
  const modelNames = new Map(modelList.map((m) => [m.id, m.name] as const))
  const languageNames = new Map(
    modelList.flatMap((m) => m.languages.map((l) => [`${m.id}/${l.code}`, l.name] as const)),
  )

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Dialect</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Audio</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead><span className="sr-only">Delete</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((sample) => (
              <TableRow key={sample.id} className="align-top">
                <TableCell className="pt-3 align-top">{modelNames.get(sample.model) ?? sample.model}</TableCell>
                <TableCell className="pt-3 align-top">{languageNames.get(`${sample.model}/${sample.language}`) ?? sample.language}</TableCell>
                <TableCell className="max-w-72 min-w-48 pt-3 align-top whitespace-normal">
                  <ExpandableText text={sample.text} max={MAX_TEXT} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sample.speakerName ?? "Unknown speaker"} · seed {sample.seed} · {sample.created.slice(0, 10)}
                  </p>
                </TableCell>
                <TableCell className="align-top">
                  <audio controls preload="none" src={`/api/samples/${sample.id}/audio`} className="h-8 w-64" />
                </TableCell>
                <TableCell className="align-top">
                  <NoteField id={sample.id} initial={sample.note} />
                </TableCell>
                <TableCell className="align-top">
                  <DeleteSampleButton id={sample.id} text={sample.text} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link href={`/saved?page=${page - 1}`} className="underline underline-offset-4">Newer</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={`/saved?page=${page + 1}`} className="underline underline-offset-4">Older</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
