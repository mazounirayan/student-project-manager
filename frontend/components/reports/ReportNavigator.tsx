'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import type { Report } from '@/types/reports'

interface ReportNavigatorProps {
  reports: Report[]
  selectedReportId: number | null
  onReportChange: (reportId: number) => void
}

export function ReportNavigator({ reports, selectedReportId, onReportChange }: ReportNavigatorProps) {
  const currentIndex = reports.findIndex(r => r.id === selectedReportId)
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      onReportChange(reports[currentIndex - 1].id)
    }
  }
  
  const goToNext = () => {
    if (currentIndex < reports.length - 1) {
      onReportChange(reports[currentIndex + 1].id)
    }
  }

  const selectedReport = reports.find(r => r.id === selectedReportId)

  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
      <FileText className="h-5 w-5 text-muted-foreground" />
      
      <Select 
        value={selectedReportId?.toString() || ''} 
        onValueChange={(v) => onReportChange(Number(v))}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Sélectionner un groupe" />
        </SelectTrigger>
        <SelectContent>
          {reports.map((report) => (
            <SelectItem key={report.id} value={report.id.toString()}>
              <div className="flex items-center justify-between w-full">
                <span>{report.group?.name || `Groupe ${report.groupId}`}</span>
                <Badge variant="secondary" className="ml-2">
                  {report.sections?.filter(s => s.content).length}/{report.sections?.length}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="icon"
          onClick={goToPrevious}
          disabled={currentIndex <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="text-sm text-muted-foreground min-w-[80px] text-center">
          {currentIndex + 1} / {reports.length}
        </span>
        
        <Button 
          variant="outline" 
          size="icon"
          onClick={goToNext}
          disabled={currentIndex >= reports.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {selectedReport && (
        <div className="ml-auto text-sm text-muted-foreground">
          Modifié le {new Date(selectedReport.updatedAt).toLocaleDateString('fr-FR')}
        </div>
      )}
    </div>
  )
}