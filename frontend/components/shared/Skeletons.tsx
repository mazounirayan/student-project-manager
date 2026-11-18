import { Skeleton } from "@/components/ui/skeleton"

/** Squelette de chargement pour une liste de cartes. */
export function CardsSkeleton({ count = 4, withHeader = false }: { count?: number; withHeader?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement en cours">
      {withHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="rounded-lg border p-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Squelette de chargement pour une page de détail (en-tête + onglets). */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement en cours">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
