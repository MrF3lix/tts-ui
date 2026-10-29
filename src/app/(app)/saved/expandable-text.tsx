"use client"

import { useState } from "react"

/** Text cut to `max` characters that shows in full when clicked, and collapses on a second click. */
export function ExpandableText({ text, max }: { text: string; max: number }) {
  const [expanded, setExpanded] = useState(false)
  if (text.length <= max) {
    return <p>{text}</p>
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      title={expanded ? "Show less" : "Show the whole text"}
      onClick={() => setExpanded(!expanded)}
      className="cursor-pointer text-left hover:text-foreground/80 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
    >
      {expanded ? text : `${text.slice(0, max).trimEnd()}…`}
    </button>
  )
}
