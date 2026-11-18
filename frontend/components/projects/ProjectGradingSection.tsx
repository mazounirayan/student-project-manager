'use client'

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Edit, Trash2, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EditGradingGridDialog } from '../grading/EditGradingGridDialog'
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

type Criterion = {
  id?: number
  name: string
  description?: string
  maxScore: number
  weight: number
  type: 'group' | 'individual' | 'other'
  hasComments?: boolean
}

type GradingGrid = {
  id: number
  name: string
  type: string
  weight: number
  description?: string
  criteria?: Criterion[]
}

interface ProjectGradingSectionProps {
  project: any
  onRefresh?: () => void
  onGridUpdated?: (grid: any) => void
}

export function ProjectGradingSection({ 
  project, 
  onRefresh,
  onGridUpdated
}: ProjectGradingSectionProps) {
  // 🔧 UN SEUL état pour les grilles
  const [grids, setGrids] = useState<GradingGrid[]>([])
  const [addingForGridId, setAddingForGridId] = useState<number | null>(null)
  const [editingCriterion, setEditingCriterion] = useState<{ gridId: number; criterion: Criterion } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean
    criterionId: number | null
    gridId: number | null 
  }>({
    open: false,
    criterionId: null,
    gridId: null
  })
  const [deleteGridDialog, setDeleteGridDialog] = useState<{ open: boolean; gridId: number | null }>({
    open: false,
    gridId: null
  })

  // 🔧 Synchroniser avec les props du projet
  useEffect(() => {
    if (project?.gradingGrids) {
      setGrids(project.gradingGrids)
    } else {
      fetchGrading()
    }
  }, [project?.gradingGrids])

  const fetchGrading = async () => {
    try {
      const token = localStorage.getItem('token')
      const gridsResponse = await fetch(
        `${NEST_BACKEND_URL}/api/grading/projects/${project.id}/grids`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const gridsData = await gridsResponse.json()
      setGrids(gridsData ?? [])
    } catch {
      setGrids([])
    }
  }

  // 🔧 API calls
  async function apiAddCriterion(gridId: number, payload: Criterion): Promise<Criterion> {
    const token = localStorage.getItem("token")
    if (!token) throw new Error('User not authenticated')

    const res = await fetch(`${NEST_BACKEND_URL}/api/grading/grids/${gridId}/criteria`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.message || 'Erreur lors de l\'ajout du critère')
    }

    return res.json()
  }

  async function apiUpdateCriterion(criterionId: number, payload: Partial<Criterion>): Promise<Criterion> {
    const token = localStorage.getItem("token")
    if (!token) throw new Error('User not authenticated')

    const res = await fetch(`${NEST_BACKEND_URL}/api/grading/criteria/${criterionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.message || 'Erreur lors de la mise à jour du critère')
    }

    return res.json()
  }

  async function apiDeleteCriterion(criterionId: number): Promise<void> {
    const token = localStorage.getItem("token")
    if (!token) throw new Error('User not authenticated')

    const res = await fetch(`${NEST_BACKEND_URL}/api/grading/criteria/${criterionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.message || 'Erreur lors de la suppression du critère')
    }
  }

  // 🔧 Handlers
  const handleOpenAddModal = (gridId: number) => {
    setAddingForGridId(gridId)
  }

  const handleCloseAddModal = () => setAddingForGridId(null)

  const handleAddCriterion = async (gridId: number, payload: Criterion) => {
    try {
      setIsLoading(true)

      const created = await apiAddCriterion(gridId, payload)

      // 🆕 Mettre à jour l'état local IMMÉDIATEMENT
      setGrids(prev =>
        prev.map(g =>
          g.id === gridId
            ? { ...g, criteria: [...(g.criteria ?? []), created] }
            : g
        )
      )

      // 🆕 Notifier le parent
      if (onGridUpdated) {
        const updatedGrid = grids.find(g => g.id === gridId)
        if (updatedGrid) {
          onGridUpdated({
            ...updatedGrid,
            criteria: [...(updatedGrid.criteria ?? []), created]
          })
        }
      }

      handleCloseAddModal()

    } catch {
      alert("Impossible d'ajouter le critère. Vérifiez votre connexion ou réessayez.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditCriterion = (gridId: number, criterion: Criterion) => {
    setEditingCriterion({ gridId, criterion })
  }

  const handleUpdateCriterion = async (criterionId: number, data: Partial<Criterion>) => {
    try {
      setIsLoading(true)

      const updated = await apiUpdateCriterion(criterionId, data)

      // 🆕 Mettre à jour immédiatement
      setGrids(prev =>
        prev.map(g => ({
          ...g,
          criteria: g.criteria?.map(c =>
            c.id === updated.id ? { ...c, ...updated } : c
          ),
        }))
      )

      // 🆕 Notifier le parent
      if (onGridUpdated) {
        const updatedGrid = grids.find(g => 
          g.criteria?.some(c => c.id === criterionId)
        )
        if (updatedGrid) {
          onGridUpdated(updatedGrid)
        }
      }

      setEditingCriterion(null)

    } catch {
      alert("Erreur lors de la mise à jour du critère.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCriterion = async () => {
    if (!deleteDialog.criterionId) return
    
    setIsLoading(true)
    try {
      await apiDeleteCriterion(deleteDialog.criterionId)

      // 🆕 Mettre à jour immédiatement
      setGrids(prev =>
        prev.map(g =>
          g.id === deleteDialog.gridId
            ? { ...g, criteria: g.criteria?.filter(c => c.id !== deleteDialog.criterionId) }
            : g
        )
      )

      // 🆕 Notifier le parent
      if (onGridUpdated) {
        const updatedGrid = grids.find(g => g.id === deleteDialog.gridId)
        if (updatedGrid) {
          onGridUpdated(updatedGrid)
        }
      }

      setDeleteDialog({ open: false, criterionId: null, gridId: null })

    } catch {
      alert("Erreur lors de la suppression du critère.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteGrid = async (gridId: number) => {
    setDeleteGridDialog({ open: true, gridId })
  }
    
  const confirmDeleteGrid = async () => {
    if (!deleteGridDialog.gridId) return
    const gridId = deleteGridDialog.gridId
    setDeleteGridDialog({ open: false, gridId: null })
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${NEST_BACKEND_URL}/api/grading/grids/${gridId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Erreur lors de la suppression')

      setGrids(prev => prev.filter(g => g.id !== gridId))

      // 🆕 Notifier le parent pour rafraîchir
      onRefresh?.()

    } catch (error) {
      alert('Erreur lors de la suppression de la grille')
    }
  }

  // 🔧 Modal components
  function AddCriterionModal({ 
    grid, 
    open, 
    onOpenChange, 
    onAdd 
  }: { 
    grid: GradingGrid
    open: boolean
    onOpenChange: (open: boolean) => void
    onAdd: (gId: number, payload: Criterion) => void 
  }) {
    const [form, setForm] = useState<Criterion>({ 
      name: '', 
      description: '', 
      maxScore: 20, 
      weight: 1, 
      type: 'group', 
      hasComments: true 
    })

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un critère à « {grid.name} »</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>Nom *</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                placeholder="Ex: Qualité du code"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Critères d'évaluation..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
          
              <div>
                <Label>Poids</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.weight } // afficher en %
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value)  })} // stocker en 0-1
              />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => onAdd(grid.id, form)}
              disabled={!form.name.trim() || isLoading}
            >
              {isLoading ? 'Ajout...' : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  function EditCriterionModal({ 
    gridId, 
    criterion, 
    open, 
    onOpenChange, 
    onSave 
  }: { 
    gridId: number
    criterion: Criterion
    open: boolean
    onOpenChange: (v: boolean) => void
    onSave: (id: number, data: Partial<Criterion>) => void 
  }) {
    const [form, setForm] = useState<Criterion>(criterion)
    
    React.useEffect(() => setForm(criterion), [criterion])
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le critère</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label>Nom</Label>
              <Input 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              
              <div>
                <Label>Poids</Label>
                <Input 
                  type="number" 
                  value={form.weight } 
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value)  })} 
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => onSave(criterion.id!, form)}
              disabled={isLoading}
            >
              {isLoading ? 'Enregistrement...' : (
                <>
                  <Edit className="mr-2 h-4 w-4" /> Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-4">
      {grids.length === 0 && (
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
          Aucune grille de notation pour ce projet.
        </div>
      )}

      {grids.map(grid => (
        <div key={grid.id} className="p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h4 className="font-semibold text-lg">
                {grid.name} 
                <Badge variant="outline" className="ml-2 text-xs">
                  {grid.type}
                </Badge>
              </h4>
              {grid.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {grid.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Poids: {Math.round(grid.weight * 100)}%
              </Badge>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleOpenAddModal(grid.id)}
              >
                <Plus className="mr-1 h-4 w-4" /> Critère
              </Button>

              <EditGradingGridDialog
                grid={grid}
                deliverables={project?.deliverables}
                onGridUpdated={onRefresh}
              />

              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleDeleteGrid(grid.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Liste des critères */}
          <div className="space-y-2">
            {(!grid.criteria || grid.criteria.length === 0) && (
              <div className="text-sm text-muted-foreground p-3 text-center border rounded bg-white/50">
                Aucun critère défini. Cliquez sur "Critère" pour en ajouter.
              </div>
            )}

            {(grid.criteria ?? []).map((c) => (
              <div 
                key={c.id} 
                className="flex items-center justify-between p-3 bg-white rounded border hover:border-primary/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {c.name}
                    {c.hasComments && (
                      <Badge variant="outline" className="text-xs">
                        Commentaires
                      </Badge>
                    )}
                  </div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline">Max: {c.maxScore}</Badge>
                  <Badge variant="secondary">Poids: {c.weight}</Badge>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEditCriterion(grid.id, c)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDeleteDialog({ 
                      open: true, 
                      criterionId: c.id!, 
                      gridId: grid.id 
                    })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal d'ajout pour cette grille */}
          {addingForGridId === grid.id && (
            <AddCriterionModal
              grid={grid}
              open={true}
              onOpenChange={(open) => { if (!open) handleCloseAddModal() }}
              onAdd={handleAddCriterion}
            />
          )}
        </div>
      ))}

      {/* Modal d'édition global */}
      {editingCriterion && (
        <EditCriterionModal
          gridId={editingCriterion.gridId}
          criterion={editingCriterion.criterion}
          open={true}
          onOpenChange={(v) => { if (!v) setEditingCriterion(null) }}
          onSave={handleUpdateCriterion}
        />
      )}

      {/* Dialog de confirmation de suppression */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        onConfirm={handleDeleteCriterion}
        title="Supprimer ce critère ?"
        description="Cette action est irréversible. Toutes les notes associées à ce critère seront également supprimées."
        confirmText="Supprimer"
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteGridDialog.open}
        onOpenChange={(open) => setDeleteGridDialog({ ...deleteGridDialog, open })}
        onConfirm={confirmDeleteGrid}
        title="Supprimer cette grille ?"
        description="Cette action est irréversible. Les critères et les notes rattachées à cette grille seront également supprimés."
        confirmText="Supprimer"
        variant="destructive"
      />
    </div>
  )
}