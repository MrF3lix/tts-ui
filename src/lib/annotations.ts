// The error categories of the annotation scheme (from ZH-Aufnahmen_Abweichungen.xlsx), grouped,
// colored and labeled as in the spreadsheet. Counts are stored per key in the samples' `errors` field,
// so keys must stay stable; labels and colors can change.

export type ErrorGroup = {
  id: string
  label: string
  // fill color of the group's columns in the spreadsheet
  color: string
  items: { key: string; label: string }[]
}

export const ERROR_GROUPS: ErrorGroup[] = [
  {
    id: "segmental",
    label: "Segmentale Phonologie",
    color: "#c6e0b4",
    items: [
      { key: "segmental_other_dialect", label: "Form eines anderen Dialekts" },
      { key: "segmental_standard", label: "Form des Standards" },
      { key: "segmental_unclassifiable", label: "nicht klassifizierbar" },
    ],
  },
  {
    id: "suprasegmental",
    label: "Suprasegmentale Phonologie",
    color: "#deebf7",
    items: [{ key: "suprasegmental", label: "Anzahl Wortformen" }],
  },
  {
    id: "lexicon",
    label: "Lexik",
    color: "#ffccff",
    items: [
      { key: "lexicon_other_dialect", label: "Form eines anderen Dialekts" },
      { key: "lexicon_standard", label: "Standardform" },
      { key: "lexicon_unclassifiable", label: "nicht klassifizierbar" },
    ],
  },
  {
    id: "morphology",
    label: "Morphologie/Morphosyntax",
    color: "#ccff66",
    items: [
      { key: "morphology_other_dialect", label: "Form eines anderen Dialekts" },
      { key: "morphology_standard", label: "Standardform" },
      { key: "morphology_unclassifiable", label: "nicht klassifizierbar" },
    ],
  },
  {
    id: "syntax",
    label: "Syntax",
    color: "#fff2cc",
    items: [{ key: "syntax", label: "Anzahl Abweichungen" }],
  },
  {
    id: "voice",
    label: "Verzerrte Stimme",
    color: "#e5e5e5",
    items: [{ key: "distorted_voice", label: "Anzahl Wortformen" }],
  },
]

export const ERROR_KEYS = ERROR_GROUPS.flatMap((g) => g.items.map((i) => i.key))

export const MAX_ERROR_COUNT = 999

export type ErrorCounts = Record<string, number>

/** Counts for all categories (0 where missing), in the order of ERROR_KEYS; unknown keys are dropped. */
export function normalizeErrors(value: unknown): ErrorCounts {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return Object.fromEntries(ERROR_KEYS.map((key) => {
    const n = source[key]
    return [key, typeof n === "number" && Number.isInteger(n) && n > 0 ? Math.min(n, MAX_ERROR_COUNT) : 0]
  }))
}

export function totalErrors(errors: ErrorCounts): number {
  return ERROR_KEYS.reduce((sum, key) => sum + (errors[key] ?? 0), 0)
}

/** Whether any category has been counted, to tell "0 errors" from "not annotated". */
export function isAnnotated(value: unknown): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
}
