"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"

type ExportSelection = {
  selecting: boolean
  setSelecting: (selecting: boolean) => void
  selected: ReadonlySet<string>
  setSelected: (update: (selected: Set<string>) => void) => void
  // ids of the samples on the current page; the export button is hidden without any
  pageIds: readonly string[]
  setPageIds: (ids: readonly string[]) => void
}

const Context = createContext<ExportSelection | null>(null)

export function ExportSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelectedState] = useState<ReadonlySet<string>>(new Set())
  const [pageIds, setPageIds] = useState<readonly string[]>([])

  const value: ExportSelection = {
    selecting,
    setSelecting: (next) => {
      setSelecting(next)
      if (!next) setSelectedState(new Set())
    },
    selected,
    setSelected: (update) => setSelectedState((prev) => {
      const next = new Set(prev)
      update(next)
      return next
    }),
    pageIds,
    setPageIds,
  }
  return <Context value={value}>{children}</Context>
}

/** The export selection, or null outside the saved samples page. */
export function useExportSelection() {
  return useContext(Context)
}

function useRequiredSelection() {
  const selection = useContext(Context)
  if (!selection) throw new Error("missing ExportSelectionProvider")
  return selection
}

/** The export button; while selecting, the number of selected samples and the download. */
export function ExportToolbar() {
  const { selecting, setSelecting, selected, pageIds } = useRequiredSelection()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!pageIds.length) {
    return null
  }
  if (!selecting) {
    return (
      <Button variant="outline" onClick={() => { setError(null); setSelecting(true) }}>
        <DownloadIcon /> Export
      </Button>
    )
  }

  async function download() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/samples/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (!response.ok) {
        const { detail } = await response.json().catch(() => ({}))
        setError(typeof detail === "string" ? detail : "The export failed. Try again later.")
        return
      }
      const blob = await response.blob()
      const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "tts-samples.zip"
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setSelecting(false)
    } catch {
      setError("The export failed. Try again later.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-live="polite">{selected.size} selected</span>
        <Button variant="ghost" disabled={pending} onClick={() => setSelecting(false)}>Cancel</Button>
        <Button disabled={pending || !selected.size} onClick={download}>
          <DownloadIcon /> {pending ? "Preparing zip…" : "Download zip"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

const CHECKBOX = "size-4 cursor-pointer accent-primary align-middle"

/** Header cell that selects all samples on the page; also tells the toolbar there are samples. */
export function SelectAllHead({ ids }: { ids: string[] }) {
  const { selecting, selected, setSelected, setPageIds } = useRequiredSelection()
  const ref = useRef<HTMLInputElement>(null)
  const count = ids.filter((id) => selected.has(id)).length

  const key = ids.join(",")
  useEffect(() => {
    setPageIds(key ? key.split(",") : [])
    return () => setPageIds([])
  }, [key, setPageIds])

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < ids.length
  })

  if (!selecting) return null
  return (
    <TableHead className="w-8">
      <input
        ref={ref}
        type="checkbox"
        aria-label="Select all samples on this page"
        className={CHECKBOX}
        checked={count > 0 && count === ids.length}
        onChange={(e) => setSelected((s) => ids.forEach((id) => (e.target.checked ? s.add(id) : s.delete(id))))}
      />
    </TableHead>
  )
}

/** A row's checkbox cell, shown while selecting samples to export. */
export function SelectRowCell({ id }: { id: string }) {
  const { selecting, selected, setSelected } = useRequiredSelection()
  if (!selecting) return null
  return (
    <TableCell className="w-8 pt-3 align-top">
      <input
        type="checkbox"
        aria-label="Select sample"
        className={CHECKBOX}
        checked={selected.has(id)}
        onChange={(e) => setSelected((s) => (e.target.checked ? s.add(id) : s.delete(id)))}
      />
    </TableCell>
  )
}
