import { Suspense } from "react"
import type { Metadata } from "next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireToken } from "@/lib/auth"
import { getHealth, getModels } from "@/lib/gateway"
import { cn } from "@/lib/utils"
import { AutoRefresh } from "./auto-refresh"

export const metadata: Metadata = {
  title: "Status · TTS",
}

export default function StatusPage() {
  return (
    <div className="mx-auto grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Status</h1>
        <p className="text-sm text-muted-foreground">Health of the TTS service and the workers running for each model.</p>
      </div>
      <Suspense fallback={<Card className="h-64 animate-pulse" />}>
        <Status />
      </Suspense>
    </div>
  )
}

async function Status() {
  const token = await requireToken()
  const [result, models] = await Promise.all([getHealth(token), getModels(token)])
  // display names are a nicety; the ids from /health are enough without them
  const names = new Map(Array.isArray(models) ? models.map((m) => [m.id, m.name]) : [])

  const up = !("error" in result) && result.health.status === "ok"
  const workers = "error" in result ? [] : Object.entries(result.health.workers).sort(([a], [b]) => a.localeCompare(b))
  const total = workers.reduce((sum, [, n]) => sum + n, 0)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("size-3 rounded-full", up ? "bg-emerald-500" : "bg-destructive")} aria-hidden />
            <CardTitle>{up ? "TTS service is running" : "TTS service is down"}</CardTitle>
          </div>
          <AutoRefresh checkedAt={result.checkedAt} />
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {"error" in result
            ? result.error
            : up
              ? `Gateway and Redis answered in ${result.latencyMs} ms · ${total} ${total === 1 ? "worker" : "workers"} across ${workers.length} ${workers.length === 1 ? "model" : "models"}.`
              : `The gateway reported status "${result.health.status}".`}
        </CardContent>
      </Card>

      {!("error" in result) && (
        <Card className="py-0">
          {workers.length === 0 ? (
            <CardContent className="py-4 text-sm text-muted-foreground">
              No models registered yet. Workers register their model when they start.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Model</TableHead>
                  <TableHead className="text-right">Workers</TableHead>
                  <TableHead className="pr-4 text-right">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.map(([id, count]) => (
                  <TableRow key={id}>
                    <TableCell className="pl-4">
                      <div className="font-medium">{names.get(id) ?? id}</div>
                      {names.has(id) && <div className="text-xs text-muted-foreground">{id}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {count > 0
                        ? <Badge variant="secondary">Available</Badge>
                        : <Badge variant="destructive">No workers</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
