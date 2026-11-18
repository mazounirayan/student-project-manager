'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  EyeOff,
  Users 
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import type { Report } from '@/types/reports'

interface ReportViewerProps {
  report: Report
  onExport?: () => void
  onPrint?: () => void
}

export function ReportViewer({ report, onExport, onPrint }: ReportViewerProps) {
  const [visibleSections, setVisibleSections] = useState<number[]>(
    report.sections?.map(s => s.id) || []
  )
  const [viewMode, setViewMode] = useState<'all' | 'completed'>('all')

  const toggleSection = (sectionId: number) => {
    setVisibleSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const toggleAllSections = () => {
    if (visibleSections.length === report.sections?.length) {
      setVisibleSections([])
    } else {
      setVisibleSections(report.sections?.map(s => s.id) || [])
    }
  }

  const sectionsToDisplay = report.sections?.filter(section => {
    if (viewMode === 'completed') {
      return section.content && section.content.trim() !== ''
    }
    return true
  }) || []

  const completedCount = report.sections?.filter(s => s.content && s.content.trim() !== '').length || 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {report.title}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{report.group?.name || `Groupe ${report.groupId}`}</span>
              {report.group?.members && (
                <Badge variant="outline">
                  {report.group.members.length} membre{report.group.members.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {report.description && (
              <p className="text-sm text-muted-foreground">{report.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={completedCount === report.sections?.length ? 'default' : 'secondary'}>
              {completedCount}/{report.sections?.length} sections
            </Badge>
            {onPrint && (
              <Button variant="outline" size="icon" onClick={onPrint}>
                <Printer className="h-4 w-4" />
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="icon" onClick={onExport}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Barre d'outils */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('all')}
            >
              Toutes les sections
            </Button>
            <Button 
              variant={viewMode === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('completed')}
            >
              Sections complétées
            </Button>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleAllSections}
          >
            {visibleSections.length === report.sections?.length ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Tout masquer
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Tout afficher
              </>
            )}
          </Button>
        </div>

        {/* Filtres de sections */}
        <div className="flex flex-wrap gap-2">
          {report.sections?.map(section => (
            <Button
              key={section.id}
              variant={visibleSections.includes(section.id) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSection(section.id)}
              className="relative"
            >
              {section.title}
              {section.content && section.content.trim() !== '' && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-4 w-4 p-0 flex items-center justify-center bg-green-500 text-white"
                >
                  ✓
                </Badge>
              )}
            </Button>
          ))}
        </div>

        <Separator />

        {/* Contenu des sections */}
        <div className="space-y-8">
          {sectionsToDisplay.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune section à afficher</p>
            </div>
          ) : (
            sectionsToDisplay
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map(section => {
                if (!visibleSections.includes(section.id)) return null

                const isEmpty = !section.content || section.content.trim() === ''

                return (
                  <div key={section.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{section.title}</h3>
                      {isEmpty && (
                        <Badge variant="outline" className="text-orange-600">
                          Non complété
                        </Badge>
                      )}
                    </div>

                    {isEmpty ? (
                      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Cette section n'a pas encore été rédigée</p>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert bg-card p-6 rounded-lg border">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                        >
                          {section.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Dernière modification : {new Date(section.updatedAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </CardContent>
    </Card>
  )
}