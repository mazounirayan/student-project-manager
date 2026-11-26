"use client"

import { MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { QuietEmpty } from "@/components/dashboard/parts"
import { plural } from "@/lib/format"
import type { Promotion } from "@/services/PromotionService"

interface PromotionCardProps {
  promotion: Promotion
  onShowStudents: () => void
  onAddStudents: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PromotionCard({ promotion, onShowStudents, onAddStudents, onEdit, onDelete }: PromotionCardProps) {
  const studentCount = promotion.students?.length ?? 0
  const projectCount = promotion.projects?.length ?? 0

  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 data-slot="card-title" className="leading-snug font-semibold">
          {promotion.name}
        </h2>
        <CardDescription>Année {promotion.year}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions sur la promotion ${promotion.name}`}>
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {promotion.description && <p className="line-clamp-2 text-sm text-muted-foreground">{promotion.description}</p>}

        <p className="flex items-center gap-2 text-sm">
          <Users aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium tabular-nums">{plural(studentCount, "étudiant")}</span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="text-muted-foreground tabular-nums">{plural(projectCount, "projet")}</span>
        </p>

        {studentCount === 0 ? (
          <div className="space-y-3">
            <QuietEmpty>Aucun étudiant pour l’instant.</QuietEmpty>
            <Button size="sm" onClick={onAddStudents}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Ajouter des étudiants
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onShowStudents}>
              Voir les étudiants
            </Button>
            <Button size="sm" variant="outline" onClick={onAddStudents}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
