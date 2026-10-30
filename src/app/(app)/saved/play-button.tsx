"use client"

import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// the button that is playing, so starting another one stops it
let playing: HTMLAudioElement | null = null

/** A play/pause button for a saved sample; the audio loads on the first click. */
export function PlayButton({ id }: { id: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState<"paused" | "loading" | "playing">("paused")

  useEffect(() => () => audio.current?.pause(), [])

  function toggle() {
    const element = audio.current
    if (!element) return
    if (!element.paused) {
      element.pause()
      return
    }
    if (playing && playing !== element) playing.pause()
    playing = element
    setState("loading")
    element.play().catch(() => setState("paused"))
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="rounded-full"
        aria-label={state === "playing" ? "Pause" : "Play"}
        title={state === "playing" ? "Pause" : "Play"}
        onClick={toggle}
      >
        {state === "playing" ? <PauseIcon /> : <PlayIcon className={state === "loading" ? "animate-pulse" : undefined} />}
      </Button>
      <audio
        ref={audio}
        preload="none"
        src={`/api/samples/${id}/audio`}
        onPlaying={() => setState("playing")}
        onPause={() => setState("paused")}
        onEnded={() => setState("paused")}
      />
    </>
  )
}
