"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatTile } from "@/components/shared/StatTile"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { QuietEmpty } from "@/components/dashboard/parts"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { plural } from "@/lib/format"
import { compareByName, compareText, fullName, initials, matchesQuery } from "@/lib/people"
import { cn } from "@/lib/utils"
import { promotionService } from "@/services/PromotionService"
import { userService, type AppUser } from "@/services/UserService"

export default function UsersPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <UsersPageContent />
    </ProtectedRoute>
  )
}

type SortKey = "name" | "email" | "role" | "status"
type Sort = { key: SortKey; dir: "asc" | "desc" }
type PromotionRef = { id: number; name: string }

const ALL = "all"
const NO_PROMOTION = "none"

const SORT_LABELS: Record<SortKey, string> = { name: "Nom", email: "E-mail", role: "Rôle", status: "Statut" }

const COMPARATORS: Record<SortKey, (a: AppUser, b: AppUser) => number> = {
  name: compareByName,
  email: (a, b) => compareText(a.email, b.email),
  role: (a, b) => compareText(a.role, b.role),
  status: (a, b) => Number(b.isActive) - Number(a.isActive),
}

function UsersPageContent() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [promotions, setPromotions] = useState<{ id: number; name: string; studentIds: number[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [search, setSearch] = useState("")
  const [role, setRole] = useState(ALL)
  const [promotion, setPromotion] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [students, teachers, mine] = await Promise.all([
        userService.getAllStudents(),
        userService.getAllTeachers(),
        // Sans les promotions, la page reste utilisable : seules les colonnes de promotion disparaissent.
        promotionService.getAll().catch(() => []),
      ])
      setUsers([...teachers, ...students])
      setPromotions(mine.map((p) => ({ id: p.id, name: p.name, studentIds: (p.students ?? []).map((s) => s.id) })))
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger les comptes."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const promotionsOf = useMemo(() => {
    const map = new Map<number, PromotionRef[]>()
    for (const p of promotions) for (const id of p.studentIds) map.set(id, [...(map.get(id) ?? []), { id: p.id, name: p.name }])
    return map
  }, [promotions])

  const students = users.filter((u) => u.role === "student")
  const inactiveCount = users.filter((u) => !u.isActive).length

  const rows = useMemo(() => {
    const filtered = users.filter((u) => {
      if (!matchesQuery(u, search)) return false
      if (role !== ALL && u.role !== role) return false
      if (status !== ALL && u.isActive !== (status === "active")) return false
      if (promotion === ALL) return true
      const mine = promotionsOf.get(u.id) ?? []
      return promotion === NO_PROMOTION ? u.role === "student" && mine.length === 0 : mine.some((p) => String(p.id) === promotion)
    })
    const compare = COMPARATORS[sort.key]
    return filtered.sort((a, b) => (compare(a, b) || compareByName(a, b)) * (sort.dir === "asc" ? 1 : -1))
  }, [users, search, role, status, promotion, sort, promotionsOf])

  const filtering = search.trim() !== "" || role !== ALL || promotion !== ALL || status !== ALL
  const resetFilters = () => {
    setSearch("")
    setRole(ALL)
    setPromotion(ALL)
    setStatus(ALL)
  }

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, dir: current.key === key && current.dir === "asc" ? "desc" : "asc" }))

  const setActive = async (target: AppUser, active: boolean) => {
    if (!active) {
      const confirmed = await confirmAction({
        title: `Désactiver le compte de ${fullName(target)} ?`,
        description: "Cette personne ne pourra plus se connecter. Ses groupes et ses rendus sont conservés, et vous pourrez réactiver le compte à tout moment.",
        confirmText: "Désactiver le compte",
        destructive: true,
      })
      if (!confirmed) return
    }
    setBusyId(target.id)
    try {
      await (active ? userService.reactivate(target.id) : userService.deactivate(target.id))
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isActive: active } : u)))
      toast.success(active ? `Le compte de ${fullName(target)} est réactivé.` : `Le compte de ${fullName(target)} est désactivé.`)
    } catch (err) {
      toast.error(active ? "Le compte n’a pas été réactivé." : "Le compte n’a pas été désactivé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setBusyId(null)
    }
  }

  const accountAction = (u: AppUser) =>
    u.role !== "student" ? null : (
      <Button variant="ghost" size="sm" disabled={busyId === u.id} aria-label={`${u.isActive ? "Désactiver" : "Réactiver"} le compte de ${fullName(u)}`} onClick={() => setActive(u, !u.isActive)}>
        {u.isActive ? "Désactiver" : "Réactiver"}
      </Button>
    )

  const promotionNames = (u: AppUser) => {
    const list = promotionsOf.get(u.id) ?? []
    if (u.role === "teacher") return <span className="text-muted-foreground">Enseignant</span>
    return list.length > 0 ? list.map((p) => p.name).join(", ") : <span className="text-muted-foreground">Aucune de vos promotions</span>
  }

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader title="Utilisateurs" description="Les comptes de la plateforme. Désactivez un compte pour couper l’accès d’un étudiant, vous pourrez le réactiver." />

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <StatTile label="Comptes" value={loading ? "–" : users.length} hint={inactiveCount > 0 ? plural(inactiveCount, "désactivé") : undefined} />
              <StatTile label="Enseignants" value={loading ? "–" : users.length - students.length} />
              <StatTile label="Étudiants" value={loading ? "–" : students.length} hint={loading ? undefined : `${students.filter((s) => promotionsOf.has(s.id)).length} dans vos promotions`} />
            </div>

            <SectionCard title="Comptes" description="Recherchez par nom ou adresse, filtrez, puis triez la liste.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[14rem] flex-1">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="search" aria-label="Rechercher un compte" placeholder="Rechercher par nom ou e-mail" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <FilterSelect label="Rôle" value={role} onChange={setRole} options={[[ALL, "Tous les rôles"], ["teacher", "Enseignants"], ["student", "Étudiants"]]} />
                  {promotions.length > 0 && (
                    <FilterSelect label="Promotion" value={promotion} onChange={setPromotion} options={[[ALL, "Toutes les promotions"], ...promotions.map((p): [string, string] => [String(p.id), p.name]), [NO_PROMOTION, "Étudiants sans promotion"]]} />
                  )}
                  {inactiveCount > 0 && <FilterSelect label="Statut" value={status} onChange={setStatus} options={[[ALL, "Tous les statuts"], ["active", "Actifs"], ["inactive", "Désactivés"]]} />}
                  <FilterSelect className="md:hidden" label="Trier par" value={sort.key} onChange={(key) => setSort({ key: key as SortKey, dir: "asc" })} options={(Object.keys(SORT_LABELS) as SortKey[]).map((key): [string, string] => [key, `Trier par ${SORT_LABELS[key].toLowerCase()}`])} />
                </div>

                <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <p aria-live="polite">{loading ? "Chargement…" : filtering ? `${rows.length} sur ${plural(users.length, "compte")}` : plural(users.length, "compte")}</p>
                  {filtering && (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      Réinitialiser les filtres
                    </Button>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-3" aria-busy="true" aria-label="Chargement en cours">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <QuietEmpty>{filtering ? "Aucun compte ne correspond à ces filtres." : "Aucun compte pour l’instant."}</QuietEmpty>
                ) : (
                  <>
                    <table className="hidden w-full text-sm md:table">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <SortHeader label="Utilisateur" column="name" sort={sort} onSort={toggleSort} />
                          <SortHeader label="E-mail" column="email" sort={sort} onSort={toggleSort} />
                          <SortHeader label="Rôle" column="role" sort={sort} onSort={toggleSort} />
                          <th scope="col" className="px-2 py-2 font-medium">Vos promotions</th>
                          <SortHeader label="Statut" column="status" sort={sort} onSort={toggleSort} />
                          <th scope="col" className="px-2 py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rows.map((u) => (
                          <tr key={u.id} className={cn("align-middle", !u.isActive && "text-muted-foreground")}>
                            <td className="px-2 py-2.5">
                              <Identity user={u} isMe={u.id === me?.id} />
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5">{u.email}</td>
                            <td className="px-2 py-2.5"><RoleBadge user={u} /></td>
                            <td className="px-2 py-2.5">{promotionNames(u)}</td>
                            <td className="px-2 py-2.5"><StatusBadge user={u} /></td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-right">{accountAction(u)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <ul className="divide-y md:hidden">
                      {rows.map((u) => (
                        <li key={u.id} className={cn("space-y-2 py-3", !u.isActive && "text-muted-foreground")}>
                          <div className="flex items-start justify-between gap-2">
                            <Identity user={u} isMe={u.id === me?.id} />
                            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                              <RoleBadge user={u} />
                              {!u.isActive && <StatusBadge user={u} />}
                            </div>
                          </div>
                          <p className="break-all text-sm">{u.email}</p>
                          {u.role === "student" && <p className="text-xs">{promotionNames(u)}</p>}
                          {u.role === "student" && <div className="-ml-3">{accountAction(u)}</div>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </SectionCard>
          </div>
        )}
      </PageContainer>
    </MainLayout>
  )
}

function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][]; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("w-[calc(50%-0.25rem)] min-w-0 sm:w-auto sm:max-w-56", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, text]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SortHeader({ label, column, sort, onSort }: { label: string; column: SortKey; sort: Sort; onSort: (key: SortKey) => void }) {
  const active = sort.key === column
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-1 py-1 font-medium">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded-sm px-1 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        {label}
        <Icon aria-hidden="true" className={cn("h-3 w-3", !active && "opacity-50")} />
      </button>
    </th>
  )
}

function Identity({ user, isMe }: { user: AppUser; isMe: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 font-medium">
        {fullName(user) || user.email}
        {isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">(vous)</span>}
      </span>
    </div>
  )
}

const RoleBadge = ({ user }: { user: AppUser }) => <Badge variant={user.role === "teacher" ? "default" : "secondary"}>{user.role === "teacher" ? "Enseignant" : "Étudiant"}</Badge>

const StatusBadge = ({ user }: { user: AppUser }) => <Badge variant={user.isActive ? "outline" : "destructive"}>{user.isActive ? "Actif" : "Désactivé"}</Badge>
