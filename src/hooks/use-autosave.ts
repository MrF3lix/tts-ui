"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// how long typing has to pause before the value is saved
const SAVE_DELAY_MS = 800
// how long "Saved" stays visible
const SAVED_VISIBLE_MS = 3000

export type AutosaveStatus = { state: "idle" | "saving" | "saved" } | { state: "error"; message: string }

// returns the value as stored (servers trim it) or an error message
export type SaveFunction = (value: string) => Promise<{ value: string } | { error: string }>

/**
 * A text value that saves itself 0.8 s after typing pauses, when `flush` is called (on blur),
 * and when the component goes away. Saves run one after another, so an older save can't
 * overwrite a newer one. `validate` returns a message for values that must not be saved.
 */
export function useAutosave(initial: string, save: SaveFunction, validate?: (value: string) => string | null) {
  const [value, setValue] = useState(initial)
  const [status, setStatus] = useState<AutosaveStatus>({ state: "idle" })
  // what the server has, and what was typed last (refs, so queued saves see current values)
  const saved = useRef(initial)
  const latest = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queue = useRef<Promise<void>>(Promise.resolve())
  // the latest functions, so a save started earlier uses current ones
  const saveRef = useRef(save)
  const validateRef = useRef(validate)
  useEffect(() => {
    saveRef.current = save
    validateRef.current = validate
  })

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    queue.current = queue.current.then(async () => {
      const current = latest.current
      // the server trims values, so whitespace-only changes need no save
      if (current.trim() === saved.current) {
        return
      }
      const invalid = validateRef.current?.(current)
      if (invalid) {
        setStatus({ state: "error", message: invalid })
        return
      }
      setStatus({ state: "saving" })
      try {
        const result = await saveRef.current(current)
        if ("error" in result) {
          setStatus({ state: "error", message: result.error })
          return
        }
        saved.current = result.value
      } catch {
        setStatus({ state: "error", message: "Saving failed. Check your connection." })
        return
      }
      // newer edits are waiting; their save reports the status
      if (latest.current.trim() === saved.current) {
        setStatus({ state: "saved" })
      }
    })
  }, [])

  const change = useCallback((next: string) => {
    setValue(next)
    latest.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [flush])

  /** Goes back to the last saved value, e.g. when an invalid value is left. */
  const revert = useCallback(() => {
    clearTimeout(timer.current)
    setValue(saved.current)
    latest.current = saved.current
    setStatus({ state: "idle" })
  }, [])

  // hide "Saved" after a while; any new status (typing, saving) cancels this
  useEffect(() => {
    if (status.state !== "saved") return
    const hide = setTimeout(() => setStatus({ state: "idle" }), SAVED_VISIBLE_MS)
    return () => clearTimeout(hide)
  }, [status])

  // save what is left when the page is left before the delay is over
  useEffect(() => () => {
    clearTimeout(timer.current)
    const current = latest.current
    if (current.trim() !== saved.current && !validateRef.current?.(current)) {
      void saveRef.current(current)
    }
  }, [])

  return { value, status, change, flush, revert }
}
