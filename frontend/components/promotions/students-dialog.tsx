"use client"

import { useMemo, useState } from "react"
import { Search, UserPlus, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QuietEmpty } from "@/components/dashboard/parts"
import { plural } from "@/lib/format"
import { compareByName, compareText, fullName, initials, matchesQuery } from "@/lib/people"
import type { Promotion, PromotionStudent } from "@/services/PromotionService"

interface StudentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promotion: Promotion
  onAdd: () => void
  /** Demande le retrait (la confirmation est gérée par l’appelant) ; résout à `true` si les étudiants ont été retirés. */
  onRemove: (students: PromotionStudent[]) => Promise<boolean>
}

type SortKey = "name" | "email"

export function StudentsDialog({ open, onOpenChange, promotion, onAdd, onRemove }: StudentsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(40rem,92vh)] flex-col sm:max-w-2xl">
        <StudentsPanel promotion={promotion} onAdd={onAdd} onRemove={onRemove} />
      </DialogContent>
    </Dialog>
  )
}

function StudentsPanel({ promotion, onAdd, onRemove }: Pick<StudentsDialogProps, "promotion" | "onAdd" | "onRemove">) {
  const students = promotion.students ?? []
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("name")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  const shown = useMemo(() => {
    const list = students.filter((student) => matchesQuery(student, query))
    return list.sort(sort === "name" ? compareByName : (a, b) => compareText(a.email, b.email))
  }, [students, query, sort])

  const selectedShown = shown.filter((student) => selected.has(student.id))
  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((student) => student.id)))

  const remove = async (targets: PromotionStudent[]) => {
    setBusy(true)
    const done = await onRemove(targets)
    if (done) setSelected(new Set())
    setBusy(false)
  }

  return (
    <>
      <DialogHeader className="pr-6">
        <DialogTitle>Étudiants de « {promotion.name} »</DialogTitle>
        <DialogDescription>{plural(students.length, "étudiant")} dans cette promotion.</DialogDescription>
      </DialogHeader>

      {students.length === 0 ? (
        <div className="space-y-3">
          <QuietEmpty>Aucun étudiant pour l’instant. Ajoutez-les depuis un fichier CSV ou JSON, une liste collée ou à la main.</QuietEmpty>
          <Button onClick={onAdd}>
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Ajouter des étudiants
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Rechercher un étudiant" placeholder="Rechercher par nom ou e-mail" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger aria-label="Trier les étudiants" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Trier par nom</SelectItem>
                <SelectItem value="email">Trier par e-mail</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={onAdd}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Ajouter
            </Button>
          </div>

          <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox className="border-muted-foreground/60" checked={allShownSelected} onCheckedChange={toggleAll} disabled={shown.length === 0} aria-label="Sélectionner tous les étudiants affichés" />
              <span aria-live="polite" className="text-muted-foreground">
                {selectedShown.length > 0 ? `${plural(selectedShown.length, "sélectionné")}` : query ? `${shown.length} sur ${students.length} affichés` : "Tout sélectionner"}
              </span>
            </label>
            {selectedShown.length > 0 && (
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => remove(selectedShown)}>
                {busy ? "Retrait…" : `Retirer de la promotion (${selectedShown.length})`}
              </Button>
            )}
          </div>

          {shown.length === 0 ? (
            <QuietEmpty>Aucun étudiant ne correspond à « {query} ».</QuietEmpty>
          ) : (
            <ul className="-mx-1 min-h-0 flex-1 divide-y overflow-y-auto rounded-md border px-1">
              {shown.map((student) => (
                <li key={student.id} className="flex items-center gap-3 px-2 py-2">
                  <Checkbox className="border-muted-foreground/60" checked={selected.has(student.id)} onCheckedChange={() => toggle(student.id)} aria-label={`Sélectionner ${fullName(student)}`} />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials(student)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(student) || student.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`Retirer ${fullName(student) || student.email} de la promotion`} onClick={() => remove([student])}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
