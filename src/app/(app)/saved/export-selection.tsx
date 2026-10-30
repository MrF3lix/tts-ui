"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TableCell, TableHead } from "@/components/ui/table"

// "all" also covers samples the page hasn't loaded yet; `ids` are then the ones left out
type Selected = { all: boolean; ids: ReadonlySet<string> }

type ExportSelection = {
  selecting: boolean
  setSelecting: (selecting: boolean) => void
  selected: Selected
  setSelected: (selected: Selected) => void
  // number of saved samples, loaded or not; the export button is hidden without any
  total: number
  setTotal: (total: number) => void
}

const NONE: Selected = { all: false, ids: new Set() }

const Context = createContext<ExportSelection | null>(null)

export function ExportSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Selected>(NONE)
  const [total, setTotal] = useState(0)

  const value: ExportSelection = {
    selecting,
    setSelecting: (next) => {
      setSelecting(next)
      if (!next) setSelected(NONE)
    },
    selected,
    setSelected,
    total,
    setTotal,
  }
  return <Context value={value}>{children}</Context>
}

function useSelection() {
  const selection = useContext(Context)
  if (!selection) throw new Error("missing ExportSelectionProvider")
  return selection
}

function selectedCount({ selected, total }: ExportSelection): number {
  return selected.all ? total - selected.ids.size : selected.ids.size
}

/** For the sample list: reports the number of samples and drops deleted ones from the selection. */
export function useSampleSelection(total: number) {
  const { setTotal, selected, setSelected } = useSelection()
  useEffect(() => {
    setTotal(total)
    return () => setTotal(0)
  }, [total, setTotal])

  return {
    deselectDeleted(id: string) {
      if (!selected.ids.has(id)) return
      const ids = new Set(selected.ids)
      ids.delete(id)
      setSelected({ ...selected, ids })
    },
  }
}

/** How many samples are saved; nothing until the list has loaded or when there are none. */
export function SampleCount() {
  const { total } = useSelection()
  if (!total) return null
  return <p className="text-sm font-medium">{total} {total === 1 ? "sample" : "samples"} saved</p>
}

/** The export button; while selecting, the number of selected samples and the download. */
export function ExportToolbar() {
  const selection = useSelection()
  const { selecting, setSelecting, selected, total } = selection
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!total) {
    return null
  }
  if (!selecting) {
    return (
      <Button variant="outline" onClick={() => { setError(null); setSelecting(true) }}>
        <DownloadIcon /> Export
      </Button>
    )
  }

  const count = selectedCount(selection)

  async function download() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/samples/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected.all ? { all: true, exclude: [...selected.ids] } : { ids: [...selected.ids] }),
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
        <span className="text-sm text-muted-foreground" aria-live="polite">{count} of {total} selected</span>
        <Button variant="ghost" disabled={pending} onClick={() => setSelecting(false)}>Cancel</Button>
        <Button disabled={pending || !count} onClick={download}>
          <DownloadIcon /> {pending ? "Preparing zip…" : "Download zip"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

const CHECKBOX = "size-4 cursor-pointer accent-primary align-middle"

/** Header cell that selects all saved samples, including the ones not loaded yet. */
export function SelectAllHead() {
  const selection = useSelection()
  const { selecting, setSelected, total } = selection
  const ref = useRef<HTMLInputElement>(null)
  const count = selectedCount(selection)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < total
  })

  if (!selecting) return null
  return (
    <TableHead className="w-8">
      <input
        ref={ref}
        type="checkbox"
        aria-label={`Select all ${total} samples`}
        className={CHECKBOX}
        checked={count > 0 && count === total}
        onChange={(e) => setSelected({ all: e.target.checked, ids: new Set() })}
      />
    </TableHead>
  )
}

/** A row's checkbox cell, shown while selecting samples to export. */
export function SelectRowCell({ id }: { id: string }) {
  const { selecting, selected, setSelected } = useSelection()
  if (!selecting) return null
  // with "all", the ids are the samples left out
  const checked = selected.all !== selected.ids.has(id)
  return (
    <TableCell className="w-8 pt-3 align-top">
      <input
        type="checkbox"
        aria-label="Select sample"
        className={CHECKBOX}
        checked={checked}
        onChange={() => {
          const ids = new Set(selected.ids)
          if (ids.has(id)) ids.delete(id)
          else ids.add(id)
          setSelected({ ...selected, ids })
        }}
      />
    </TableCell>
  )
}
