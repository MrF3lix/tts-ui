"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { AutosaveStatus } from "@/components/autosave-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAutosave } from "@/hooks/use-autosave"
import { ERROR_GROUPS, type ErrorCounts, MAX_ERROR_COUNT, normalizeErrors, totalErrors } from "@/lib/annotations"
import { saveErrors } from "./actions"

// the counts as a string, so they can autosave like a text field
const serialize = (errors: ErrorCounts) => JSON.stringify(normalizeErrors(errors))

/** Error counts per category, grouped and colored like the spreadsheet; saved automatically. */
export function ErrorAnnotation({ id, initial, annotated }: { id: string; initial: ErrorCounts; annotated: boolean }) {
  // an unannotated sample starts empty, so its first save stores the zeros as well
  const state = useAutosave(annotated ? serialize(initial) : "", async (value) => {
    const result = await saveErrors(id, JSON.parse(value))
    return "error" in result ? result : { value: serialize(result.errors) }
  })
  const errors = normalizeErrors(state.value ? JSON.parse(state.value) : {})

  function set(key: string, count: number) {
    const clamped = Math.max(0, Math.min(MAX_ERROR_COUNT, Number.isFinite(count) ? Math.trunc(count) : 0))
    state.change(serialize({ ...errors, [key]: clamped }))
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-medium">Abweichungen</h2>
        {state.value ? (
          <p className="text-sm">Total Abweichungen <span className="font-semibold tabular-nums">{totalErrors(errors)}</span></p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Noch nicht annotiert
            <Button type="button" variant="outline" size="xs" onClick={() => { state.change(serialize({})); state.flush() }}>
              Keine Abweichungen
            </Button>
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ERROR_GROUPS.map((group) => {
          const subtotal = group.items.reduce((sum, item) => sum + errors[item.key], 0)
          return (
            <fieldset
              key={group.id}
              className="grid content-start gap-2 rounded-lg border border-l-8 p-3"
              style={{ borderLeftColor: group.color, backgroundColor: `color-mix(in oklab, ${group.color} 18%, transparent)` }}
            >
              <legend className="sr-only">{group.label}</legend>
              <div aria-hidden className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{group.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{subtotal}</span>
              </div>
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <label htmlFor={`errors-${item.key}`} className="text-sm text-muted-foreground">{item.label}</label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Eins weniger: ${group.label}, ${item.label}`}
                      disabled={errors[item.key] === 0}
                      onClick={() => set(item.key, errors[item.key] - 1)}
                    >
                      <MinusIcon />
                    </Button>
                    <Input
                      id={`errors-${item.key}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_ERROR_COUNT}
                      value={errors[item.key]}
                      onChange={(e) => set(item.key, e.target.valueAsNumber)}
                      onFocus={(e) => e.target.select()}
                      onBlur={state.flush}
                      className="h-7 w-14 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Eins mehr: ${group.label}, ${item.label}`}
                      onClick={() => set(item.key, errors[item.key] + 1)}
                    >
                      <PlusIcon />
                    </Button>
                  </div>
                </div>
              ))}
            </fieldset>
          )
        })}
      </div>
      <AutosaveStatus status={state.status} />
    </div>
  )
}
