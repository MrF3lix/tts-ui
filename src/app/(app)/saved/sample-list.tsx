"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SampleCursor, SavedSample } from "@/lib/samples"
import { loadMoreSamples } from "./actions"
import { DeleteSampleButton } from "./delete-sample-button"
import { ExpandableText } from "./expandable-text"
import { SelectAllHead, SelectRowCell, useSampleSelection } from "./export-selection"
import { NoteField } from "./note-field"

const MAX_TEXT = 80

type Props = {
  initialItems: SavedSample[]
  initialNext: SampleCursor | null
  initialTotal: number
  // display names by model id and by "model/language code"
  modelNames: Record<string, string>
  languageNames: Record<string, string>
}

/** The saved samples table; loads the next page when its end scrolls into view. */
export function SampleList({ initialItems, initialNext, initialTotal, modelNames, languageNames }: Props) {
  const [items, setItems] = useState(initialItems)
  const [next, setNext] = useState(initialNext)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const { deselectDeleted } = useSampleSelection(total)

  const loadMore = useCallback(async () => {
    if (!next || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await loadMoreSamples(next)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setItems((prev) => {
        const seen = new Set(prev.map((s) => s.id))
        return [...prev, ...result.items.filter((s) => !seen.has(s.id))]
      })
      setNext(result.next)
    } catch {
      setError("Loading more samples failed.")
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [next])

  // start loading a bit before the end of the table is visible
  useEffect(() => {
    const element = sentinel.current
    if (!element || !next || error) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore()
    }, { rootMargin: "600px 0px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [next, error, loadMore])

  function removed(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    deselectDeleted(id)
  }

  if (items.length === 0 && !next) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing saved yet. Use <span className="font-medium">Save</span> on a finished variant on
        the <Link href="/" className="underline underline-offset-4">generate page</Link>.
      </p>
    )
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SelectAllHead />
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
                <SelectRowCell id={sample.id} />
                <TableCell className="pt-3 align-top">{modelNames[sample.model] ?? sample.model}</TableCell>
                <TableCell className="pt-3 align-top">{languageNames[`${sample.model}/${sample.language}`] ?? sample.language}</TableCell>
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
                  <DeleteSampleButton id={sample.id} text={sample.text} onDeleted={() => removed(sample.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div ref={sentinel} className="flex min-h-8 items-center justify-center text-sm text-muted-foreground">
        {error ? (
          <span className="flex items-center gap-2">
            <span className="text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={loadMore}>Try again</Button>
          </span>
        ) : loading ? (
          "Loading more samples…"
        ) : !next && items.length > initialItems.length ? (
          `All ${items.length} samples loaded`
        ) : null}
      </div>
    </div>
  )
}
