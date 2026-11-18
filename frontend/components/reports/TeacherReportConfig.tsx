// components/reports/TeacherReportConfig.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, GripVertical, Save, Send, Trash } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Swal from 'sweetalert2'
import { ReportSectionConfigItem } from './ReportSectionConfigItem'

const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export interface ReportSectionConfig {
  id?: number
  title: string
  description: string
  required: boolean
  wordLimit?: number
  order: number
}

interface ReportTemplate {
  id?: number
  projectId: number
  isEnabled: boolean
  sections: ReportSectionConfig[]
  deadline?: string
  format: 'markdown' | 'html'
  instructions?: string
}

interface TeacherReportConfigProps {
  projectId: number
}

export function TeacherReportConfig({ projectId }: TeacherReportConfigProps) {
  const [config, setConfig] = useState<ReportTemplate>({
    projectId,
    isEnabled: false,
    sections: [],
    format: 'markdown',
    instructions: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [projectId])

const fetchConfig = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(
      `${NEST_BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      // 🔧 Vérifier que data n'est pas null/undefined
      if (data && data.id) {
        setConfig({
          ...data,
          sections: data.sections || []
        })
      } else {
        // Configuration par défaut si rien n'existe
        setConfig({
          projectId,
          isEnabled: false,
          sections: [],
          format: 'markdown',
          instructions: ''
        })
      }
    } else {
      // Si erreur 404, c'est normal (pas encore de config)
      setConfig({
        projectId,
        isEnabled: false,
        sections: [],
        format: 'markdown',
        instructions: ''
      })
    }
  } catch (error) {
    setConfig({
      projectId,
      isEnabled: false,
      sections: [],
      format: 'markdown',
      instructions: ''
    })
  } finally {
    setLoading(false)
  }
}

  const addSection = () => {
    setConfig(prev => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          title: `Nouvelle section ${prev.sections.length + 1}`,
          description: '',
          required: true,
          order: prev.sections.length,
          wordLimit: undefined
        }
      ]
    }))
  }

  const updateSection = (index: number, updates: Partial<ReportSectionConfig>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map((section, i) => 
        i === index ? { ...section, ...updates } : section
      )
    }))
  }

// TeacherReportConfig.tsx

const removeSection = async (index: number) => {
  const section = config.sections[index];
  
  // Si la section a un ID, elle existe en base de données
  if (section.id) {
    const result = await Swal.fire({
      title: 'Supprimer cette section ?',
      text: 'Cette action supprimera aussi tout le contenu déjà rédigé par les étudiants',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${NEST_BACKEND_URL}/api/reports/section-config/${section.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      await Swal.fire({
        title: 'Section supprimée',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      await Swal.fire({
        title: 'Erreur',
        text: 'Impossible de supprimer la section',
        icon: 'error'
      });
      return; // Ne pas supprimer du state si erreur
    }
  }

  // Supprimer du state local
  setConfig(prev => ({
    ...prev,
    sections: prev.sections.filter((_, i) => i !== index)
  }));
};

// Supprimer toute la configuration
const deleteConfig = async () => {
  if (!config.id) {
    // Si pas d'ID, juste réinitialiser le state
    setConfig({
      projectId,
      isEnabled: false,
      sections: [],
      format: 'markdown',
      instructions: ''
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Supprimer la configuration ?',
    html: `
      <p>Cette action est irréversible et supprimera :</p>
      <ul style="text-align: left; margin-left: 20px;">
        <li>Toutes les sections configurées</li>
        <li>Tous les rapports rédigés par les étudiants</li>
      </ul>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Oui, tout supprimer',
    cancelButtonText: 'Annuler'
  });

  if (!result.isConfirmed) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${NEST_BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }

    await Swal.fire({
      title: 'Configuration supprimée',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });

    // Réinitialiser la configuration
    setConfig({
      projectId,
      isEnabled: false,
      sections: [],
      format: 'markdown',
      instructions: ''
    });
  } catch (error) {
    await Swal.fire({
      title: 'Erreur',
      text: 'Impossible de supprimer la configuration',
      icon: 'error'
    });
  }
};

  const moveSection = (fromIndex: number, toIndex: number) => {
    const sections = [...config.sections]
    const [movedSection] = sections.splice(fromIndex, 1)
    sections.splice(toIndex, 0, movedSection)
    
    // Mettre à jour l'ordre
    const updatedSections = sections.map((section, index) => ({
      ...section,
      order: index
    }))

    setConfig(prev => ({ ...prev, sections: updatedSections }))
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${NEST_BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(config)
        }
      )

      if (!response.ok) throw new Error('Erreur sauvegarde')

      await Swal.fire({
        title: 'Configuration sauvegardée',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      })

      // Recharger la configuration pour avoir les IDs
      await fetchConfig()
    } catch (error) {
      await Swal.fire({
        title: 'Erreur',
        text: 'Impossible de sauvegarder la configuration',
        icon: 'error'
      })
    } finally {
      setSaving(false)
    }
  }



  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Chargement...</div>
        </CardContent>
      </Card>
    )
  }

 return (
 <div className="h-[calc(100vh-6rem)] overflow-y-auto px-4 sm:px-8 py-6 space-y-6 bg-neutral-50 dark:bg-neutral-900">
    <Card className="max-w-3xl mx-auto shadow-md border border-neutral-200 dark:border-neutral-800">
      <CardHeader className="bg-neutral-100 dark:bg-neutral-800 rounded-t-lg border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              Configuration du rapport
            </CardTitle>
            <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400">
              Activez et configurez les rapports pour ce projet
            </CardDescription>
          </div>
          {/* Bouton de suppression */}
          {config.id && (
            <Button 
              onClick={deleteConfig} 
              variant="destructive" 
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Activation du rapport */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Rapport activé</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Les étudiants pourront rédiger leur rapport en ligne
            </p>
          </div>
          <Switch
            checked={config.isEnabled}
            onCheckedChange={(enabled) =>
              setConfig((prev) => ({ ...prev, isEnabled: enabled }))
            }
             className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300"
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-6">
            {/* Instructions générales */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions générales</Label>
              <Textarea
                id="instructions"
                placeholder="Instructions pour la rédaction du rapport..."
                value={config.instructions}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, instructions: e.target.value }))
                }
                rows={5}
                className="break-words resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label>Format de rédaction</Label>
              <Select
                value={config.format}
                onValueChange={(format: 'markdown' | 'html') =>
                  setConfig((prev) => ({ ...prev, format }))
                }
              >
                <SelectTrigger className="focus:ring-2 focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="Choisir un format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="markdown">Markdown (recommandé)</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date limite */}
            <div className="space-y-2">
              <Label htmlFor="deadline">Date limite de soumission</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={config.deadline}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, deadline: e.target.value }))
                }
                className="focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Sections du rapport</Label>
                <Button onClick={addSection} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une section
                </Button>
              </div>

              {config.sections.length === 0 ? (
                <Alert className="border-dashed">
                  <AlertDescription>
                    Aucune section définie — les étudiants auront un éditeur libre.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {config.sections.map((section, index) => (
                    <ReportSectionConfigItem
                      key={index}
                      section={section}
                      index={index}
                      onUpdate={(updates) => updateSection(index, updates)}
                      onRemove={() => removeSection(index)}
                      onMoveUp={index > 0 ? () => moveSection(index, index - 1) : undefined}
                      onMoveDown={index < config.sections.length - 1 ? () => moveSection(index, index + 1) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button onClick={saveConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>

              <Button onClick={deleteConfig} variant="outline" className="text-destructive">
                <Trash className="h-4 w-4 mr-2" />
                Supprimer la configuration
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
)

}