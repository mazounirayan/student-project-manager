"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api"

/** Charge les données de l’accueil et expose chargement, erreur et rechargement. */
export function useOverview<T>(load: () => Promise<T>, fallbackError: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await load())
    } catch (err) {
      setError(errorMessage(err, fallbackError))
    } finally {
      setLoading(false)
    }
  }, [load, fallbackError])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

/** Ligne cliquable d’une liste de carte : texte à gauche, repères (badges, dates) à droite. */
export function RowLink({ href, children, aside }: { href: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-[1_1_12rem]">{children}</span>
        {aside && <span className="flex flex-wrap items-center gap-2">{aside}</span>}
      </Link>
    </li>
  )
}

/** Message de liste vide : dit ce qu’il en est et, si utile, ce qu’il reste à faire. */
export function QuietEmpty({ children, done = false }: { children: ReactNode; done?: boolean }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      {done && <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
      <span>{children}</span>
    </p>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement en cours">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
