'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import Swal from 'sweetalert2'
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

interface CreateGradingGridDialogProps {
  projectId: number
  deliverables?: Array<{ id: number; title: string }>
  onGridCreated?: (grid: any) => void
}

export function CreateGradingGridDialog({ 
  projectId, 
  deliverables = [],
  onGridCreated 
}: CreateGradingGridDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'deliverable' as 'deliverable' | 'report' | 'defense',
    weight: 1,
    deliverableId: undefined as number | undefined
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
        if (!token) {
          setLoading(false)
          return
        }

      const response = await fetch(`${NEST_BACKEND_URL}/api/grading/grids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          projectId
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || 'Erreur lors de la création de la grille')
      }

      const grid = await response.json()
       await Swal.fire({
      title: 'Grille créée !',
      html: `
        <p class="text-green-600 font-medium">${formData.name}</p>
        <p class="text-sm text-gray-600 mt-2">
          Vous pouvez maintenant ajouter des critères d'évaluation
        </p>
      `,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    })
      onGridCreated?.(grid)
      
      setFormData({
        name: '',
        description: '',
        type: 'deliverable',
        weight: 1,
        deliverableId: undefined
      })
      setOpen(false)
    } catch (error) {
          Swal.fire({
            title: 'Erreur',
            text: (error as Error).message || 'Impossible de créer la grille',
            icon: 'error',
            timer: 2000
          })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Créer une grille de notation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle grille de notation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom de la grille *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Évaluation Livrable Sprint 1"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deliverable">Livrable</SelectItem>
                  <SelectItem value="report">Rapport</SelectItem>
                  <SelectItem value="defense">Soutenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

          
            <div className="grid gap-2">
              <Label htmlFor="weight">Poids (coefficient) *</Label>
              <Input
                id="weight"
                type="number"
                min={0}
                max={100}
                step={1}
                value={formData.weight * 100}
                onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) / 100 })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Le poids sera utilisé pour calculer la note finale du projet
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Objectifs et critères généraux de cette évaluation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer la grille'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}