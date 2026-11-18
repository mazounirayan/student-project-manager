"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart3, CheckCircle2, Download, Save, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { fetchMyProjects, type Project } from "@/services/project.service"
import { apiGet, apiPost, apiPut } from "@/lib/api"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { toast } from "sonner"

type SummaryGrade = { id: number; gridId: number; gridName: string; totalScore: number; isValidated: boolean }
type SummaryGroup = { id: number; name: string; grades: SummaryGrade[]; finalGrade: number }
type SummaryGrid = { id: number; name: string; type: string; weight: number }
type Summary = {
  gradingGrids: SummaryGrid[]
  grids?: SummaryGrid[]
  groups: SummaryGroup[]
  allValidated: boolean
}

export default function GradingSummaryPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <GradingSummaryPageContent />
    </ProtectedRoute>
  )
}

function GradingSummaryPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [weights, setWeights] = useState<Map<number, number>>(new Map())
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMyProjects()
      const list = Array.isArray(data) ? data : []
      setProjects(list)
      if (list.length > 0) setSelectedProjectId(String(list[0].id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos projets.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    if (!selectedProjectId) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const data = await apiGet<Summary>(`/grading/projects/${selectedProjectId}/summary`)
      setSummary(data)
      const grids = data.gradingGrids ?? data.grids ?? []
      const weightsMap = new Map<number, number>()
      grids.forEach((grid) => weightsMap.set(grid.id, Math.round(grid.weight * 1000) / 10))
      setWeights(weightsMap)
    } catch (err) {
      setSummary(null)
      setSummaryError(err instanceof Error ? err.message : "Impossible de charger la synthèse de notation.")
    } finally {
      setSummaryLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const grids = summary?.gradingGrids ?? summary?.grids ?? []

  const handleWeightChange = (gridId: number, value: number) => {
    setWeights((prev) => {
      const next = new Map(prev)
      next.set(gridId, value)
      return next
    })
  }

  const saveWeights = async () => {
    if (!selectedProjectId) return
    const total = Array.from(weights.values()).reduce((sum, w) => sum + w, 0)
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`La somme des poids doit être 100 % (actuellement ${total.toFixed(1).replace(".", ",")} %).`)
      return
    }
    setSaving(true)
    try {
      await apiPut(`/grading/projects/${selectedProjectId}/weights`, {
        weights: Array.from(weights.entries()).map(([gridId, weight]) => ({ gridId, weight: weight / 100 })),
      })
      toast.success("Pondérations sauvegardées.")
      await loadSummary()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde des poids.")
    } finally {
      setSaving(false)
    }
  }

  const publishGrades = async () => {
    if (!selectedProjectId || !summary) return
    setPublishing(true)
    try {
      await apiPost("/grading/grades/validate", { projectId: Number(selectedProjectId) })
      toast.success("Notes publiées aux étudiants.")
      await loadSummary()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la publication des notes.")
    } finally {
      setPublishing(false)
    }
  }

  const exportCsv = async () => {
    if (!selectedProjectId) return
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/grading/projects/${selectedProjectId}/export`,
        { headers: { Authorization: `Bearer ${window.localStorage.getItem("token")}` } }
      )
      if (!res.ok) throw new Error("export indisponible")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `notes-projet-${selectedProjectId}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error && err.message !== "export indisponible"
        ? err.message
        : "L'export des notes n'est pas disponible actuellement.")
    }
  }

  const projectName = projects.find((p) => String(p.id) === selectedProjectId)?.name

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Évaluations</h1>
            <p className="text-muted-foreground">Synthèse de notation, pondération et publication des notes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 && (
              <Select value={selectedProjectId ?? undefined} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full sm:w-[260px]">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadProjects} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Aucun projet pour le moment"
            description="Créez un projet et des grilles de notation pour visualiser la synthèse ici."
          />
        ) : summaryLoading ? (
          <CardsSkeleton count={2} />
        ) : summaryError || !summary ? (
          <ErrorState message={summaryError ?? "Synthèse indisponible."} onRetry={loadSummary} />
        ) : (
          <>
            {grids.length === 0 && (
              <Alert className="mb-6">
                <BarChart3 aria-hidden="true" className="h-4 w-4" />
                <AlertDescription>
                  Aucune grille de notation pour ce projet. Créez des grilles depuis l'onglet « Notation » de la page
                  projet.
                </AlertDescription>
              </Alert>
            )}

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Groupes évalués</CardTitle>
                  <BarChart3 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.groups.filter((g) => g.grades.length > 0).length}/{summary.groups.length}
                  </div>
                  <p className="text-xs text-muted-foreground">{projectName ?? ""}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Notes validées</CardTitle>
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.groups.reduce((sum, g) => sum + g.grades.filter((gr) => gr.isValidated).length, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Sur {grids.length * summary.groups.length} attendues</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Publication</CardTitle>
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.allValidated ? "Prête" : "En attente"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.allValidated ? "Toutes les notes sont validées" : "Validez toutes les notes d'abord"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {grids.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Pondération des grilles</CardTitle>
                  <CardDescription>Le total doit faire 100 %.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {grids.map((grid) => (
                    <div key={grid.id} className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1 text-sm font-medium">{grid.name}</span>
                      <Badge variant="outline">{grid.type === "deliverable" ? "Livrable" : grid.type === "report" ? "Rapport" : "Soutenance"}</Badge>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        className="w-24"
                        value={weights.get(grid.id) ?? Math.round(grid.weight * 1000) / 10}
                        onChange={(e) => handleWeightChange(grid.id, Number(e.target.value))}
                        aria-label={`Poids de la grille ${grid.name} en pourcentage`}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      Total : {(Array.from(weights.values()).reduce((sum, w) => sum + w, 0)).toFixed(1).replace(".", ",")} %
                    </span>
                    <Button onClick={saveWeights} disabled={saving}>
                      <Save aria-hidden="true" className="mr-2 h-4 w-4" />
                      {saving ? "Sauvegarde…" : "Sauvegarder les poids"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {summary.groups.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Aucun groupe pour ce projet"
                description="Constituez des groupes depuis la page projet pour évaluer les étudiants."
              />
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Notes par groupe</CardTitle>
                      <CardDescription>Note finale pondérée et statut de chaque évaluation</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={exportCsv}>
                        <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                        Exporter (CSV)
                      </Button>
                      <Button variant="default" onClick={publishGrades} disabled={publishing || !summary.allValidated}>
                        <CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />
                        {publishing ? "Publication…" : "Publier les notes"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Groupe</TableHead>
                        {grids.map((grid) => (
                          <TableHead key={grid.id} className="text-right">{grid.name}</TableHead>
                        ))}
                        <TableHead className="text-right">Note finale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.groups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          {grids.map((grid) => {
                            const grade = group.grades.find((gr) => gr.gridId === grid.id)
                            return (
                              <TableCell key={grid.id} className="text-right">
                                {grade ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="font-medium">{grade.totalScore.toFixed(1).replace(".", ",")}/20</span>
                                    <Badge variant={grade.isValidated ? "default" : "secondary"}>
                                      {grade.isValidated ? "Validée" : "Brouillon"}
                                    </Badge>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-right font-bold">
                            {group.finalGrade.toFixed(2).replace(".", ",")}/20
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}
