'use client'

import { formatDateTime, formatNumber } from "@/lib/format"
import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, FileText, CheckCircle2, Clock } from 'lucide-react'
import type { Report } from '@/types/reports'

interface ReportsSummaryTableProps {
  reports: Report[]
  onViewReport: (reportId: number) => void
  grades?: Record<number, number> // reportId -> grade
}

export function ReportsSummaryTable({ reports, onViewReport, grades = {} }: ReportsSummaryTableProps) {
  const [sortBy, setSortBy] = useState<'group' | 'progress' | 'date'>('group')

  const sortedReports = [...reports].sort((a, b) => {
    switch (sortBy) {
      case 'group':
        return (a.group?.name || '').localeCompare(b.group?.name || '')
      case 'progress': {
        const aCompleted = a.sections?.filter(s => s.content).length || 0
        const bCompleted = b.sections?.filter(s => s.content).length || 0
        return bCompleted - aCompleted
      }
      case 'date':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      default:
        return 0
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between">
        <h3 className="text-lg font-semibold flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5" />
          Vue d’ensemble des rapports
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={sortBy === 'group' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('group')}
          >
            Par groupe
          </Button>
          <Button
            variant={sortBy === 'progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('progress')}
          >
            Par progression
          </Button>
          <Button
            variant={sortBy === 'date' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('date')}
          >
            Par date
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Groupe</TableHead>
              <TableHead>Progression</TableHead>
              <TableHead>Dernière modification</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReports.map((report) => {
              const completedSections = report.sections?.filter(s => s.content && s.content.trim() !== '').length || 0
              const totalSections = report.sections?.length || 0
              const progress = totalSections > 0 ? (completedSections / totalSections) * 100 : 0
              const isComplete = completedSections === totalSections && totalSections > 0
              const grade = grades[report.id]

              return (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {report.group?.name || `Groupe ${report.groupId}`}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 max-w-[120px]">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            isComplete ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {completedSections}/{totalSections}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(report.updatedAt)}
                  </TableCell>
                  
                  <TableCell>
                    {isComplete ? (
                      <Badge className="bg-green-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Complet
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        En cours
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {grade !== undefined ? (
                      <Badge variant="outline" className="font-mono">
                        {formatNumber(grade, 2)}/20
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onViewReport(report.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Voir
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}