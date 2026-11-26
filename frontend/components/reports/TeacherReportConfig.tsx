// components/reports/TeacherReportConfig.tsx
'use client'

import { BACKEND_URL, assertOk, errorMessage } from "@/lib/api"
import { toast } from "sonner"
import { confirmAction } from "@/lib/dialogs"
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save, Trash } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReportSectionConfigItem } from './ReportSectionConfigItem'

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
      `${BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (response.ok) {
      const data = await response.json()
      if (data && data.id) {
        setConfig({
          ...data,
          sections: data.sections || []
        })
      } else {
        // Configuration par défaut si rien n’existe
        setConfig({
          projectId,
          isEnabled: false,
          sections: [],
          format: 'markdown',
          instructions: ''
        })
      }
    } else {
      // Si erreur 404, c’est normal (pas encore de config)
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


const removeSection = async (index: number) => {
  const section = config.sections[index];
  
  // Si la section a un ID, elle existe en base de données
  if (section.id) {
    const confirmed = await confirmAction({ title: 'Supprimer cette section ?', description: 'Cette action supprimera aussi tout le contenu déjà rédigé par les étudiants', confirmText: 'Oui, supprimer', destructive: true });

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/reports/section-config/${section.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      await assertOk(response)

      toast.success('Section supprimée');
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de supprimer la section') });
      return; // Ne pas supprimer du state si erreur
    }
  }

  setConfig(prev => ({
    ...prev,
    sections: prev.sections.filter((_, i) => i !== index)
  }));
};

const deleteConfig = async () => {
  if (!config.id) {
    // Si pas d’ID, juste réinitialiser le state
    setConfig({
      projectId,
      isEnabled: false,
      sections: [],
      format: 'markdown',
      instructions: ''
    });
    return;
  }

  const confirmed = await confirmAction({
    title: 'Supprimer la configuration ?',
    description: 'Cette action est irréversible : les sections configurées et tous les rapports rédigés par les étudiants seront supprimés.',
    confirmText: 'Tout supprimer',
    destructive: true,
  });

  if (!confirmed) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    await assertOk(response)

    toast.success('Configuration supprimée');

    setConfig({
      projectId,
      isEnabled: false,
      sections: [],
      format: 'markdown',
      instructions: ''
    });
  } catch (error) {
    toast.error('Erreur', { description: errorMessage(error, 'Impossible de supprimer la configuration') });
  }
};

  const moveSection = (fromIndex: number, toIndex: number) => {
    const sections = [...config.sections]
    const [movedSection] = sections.splice(fromIndex, 1)
    sections.splice(toIndex, 0, movedSection)
    
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
        `${BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(config)
        }
      )

      await assertOk(response)

      toast.success('Configuration sauvegardée')

      // Recharger la configuration pour avoir les IDs
      await fetchConfig()
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de sauvegarder la configuration') })
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
 <div className="h-[calc(100vh-6rem)] overflow-y-auto px-4 sm:px-8 py-6 space-y-6 bg-background">
    <Card className="max-w-3xl mx-auto shadow-md">
      <CardHeader className="bg-muted rounded-t-lg border-b">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Configuration du rapport
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Activez et configurez les rapports pour ce projet
            </CardDescription>
          </div>
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
        <div className="flex flex-wrap items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
          <div>
            <h3 className="font-semibold text-foreground">Rapport activé</h3>
            <p className="text-sm text-muted-foreground">
              Les étudiants pourront rédiger leur rapport en ligne
            </p>
          </div>
          <Switch
            checked={config.isEnabled}
            onCheckedChange={(enabled) =>
              setConfig((prev) => ({ ...prev, isEnabled: enabled }))
            }
             
          />
        </div>

        {config.isEnabled && (
          <div className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="deadline">Date limite de rendu</Label>
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

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between">
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

            <div className="flex flex-wrap gap-3 pt-4 border-t">
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