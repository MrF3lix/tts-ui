"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deleteSample } from "./actions"

export function DeleteSampleButton({ id, text }: { id: string; text: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await deleteSample(id)
      if (result.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      // reload the table (and the page count)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); setError(null) }}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" />}>
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this sample?</AlertDialogTitle>
          <AlertDialogDescription>
            This sample<br />
            <i>“{text.length > 120 ? `${text.slice(0, 50).trimEnd()}…` : text}”</i><br /> and its notes are deleted permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog >
  )
}
