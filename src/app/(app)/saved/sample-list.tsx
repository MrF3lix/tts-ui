"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PencilIcon } from "lucide-react"
import { LocalTime } from "@/components/local-time"
import { Button, buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SampleCursor, SavedSample } from "@/lib/samples"
import { loadMoreSamples } from "./actions"
import { DeleteSampleButton } from "./delete-sample-button"
import { SelectAllHead, SelectRowCell, useSampleSelection } from "./export-selection"
import { PlayButton } from "./play-button"

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

  // Next.js keeps the page mounted (hidden) after navigating away, so this state survives; when
  // coming back, the server sends the current samples, which replace the ones loaded before
  const [source, setSource] = useState(initialItems)
  if (source !== initialItems) {
    setSource(initialItems)
    setItems(initialItems)
    setNext(initialNext)
    setTotal(initialTotal)
    setError(null)
  }

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
              <TableHead>Sample</TableHead>
              <TableHead className="hidden md:table-cell">Generated with</TableHead>
              <TableHead>Annotation</TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="hidden md:table-cell">Saved</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((sample) => (
              <TableRow key={sample.id} className="align-top">
                <SelectRowCell id={sample.id} />
                <TableCell className="max-w-72 min-w-48 align-top whitespace-normal">
                  <div className="flex items-start gap-3">
                    <PlayButton id={sample.id} />
                    <Link
                      href={`/saved/${sample.id}`}
                      title={sample.text}
                      className="line-clamp-2 hover:underline hover:underline-offset-4"
                    >
                      {sample.text}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="hidden pt-3 align-top whitespace-normal md:table-cell">
                  <p className="font-medium">{modelNames[sample.model] ?? sample.model}</p>
                  <p>{languageNames[`${sample.model}/${sample.language}`] ?? sample.language}</p>
                  <p className="text-xs text-muted-foreground">{sample.speakerName ?? "Unknown speaker"} · seed {sample.seed}</p>
                </TableCell>
                <TableCell className="pt-3 align-top">
                  <Link href={`/saved/${sample.id}`} className="grid hover:underline hover:underline-offset-4">
                    {sample.errorTotal === null ? (
                      <span className="text-muted-foreground">Not annotated</span>
                    ) : (
                      <span className="font-medium">{sample.errorTotal} {sample.errorTotal === 1 ? "Abweichung" : "Abweichungen"}</span>
                    )}
                    {sample.hasDieth && <span className="text-xs text-muted-foreground">Dieth transcript</span>}
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-64 min-w-40 pt-3 align-top whitespace-normal sm:table-cell">
                  {sample.note
                    ? <p title={sample.note} className="line-clamp-2 text-muted-foreground">{sample.note}</p>
                    : <span className="text-muted-foreground/50">—</span>}
                </TableCell>
                <TableCell className="hidden pt-3 align-top text-muted-foreground tabular-nums md:table-cell">
                  <LocalTime value={sample.created} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/saved/${sample.id}`}
                      aria-label="Edit annotation"
                      title="Edit annotation"
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    >
                      <PencilIcon />
                    </Link>
                    <DeleteSampleButton id={sample.id} text={sample.text} onDeleted={() => removed(sample.id)} />
                  </div>
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
