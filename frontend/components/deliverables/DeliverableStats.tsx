"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent, formatDecimal } from "@/lib/format"
import { FileCheck, Clock, AlertTriangle, Users } from "lucide-react"

interface DeliverableStatsProps {
  deliverable: any
  totalGroups: number
}

export function DeliverableStats({ deliverable, totalGroups }: DeliverableStatsProps) {
  const submissions = deliverable.submissions || []
  
  const onTimeCount = submissions.filter((s: any) => {
    if (!s.submittedAt) return false
    return new Date(s.submittedAt) <= new Date(deliverable.deadline)
  }).length
  
  const lateCount = submissions.filter((s: any) => {
    if (!s.submittedAt) return false
    return new Date(s.submittedAt) > new Date(deliverable.deadline)
  }).length
  
  const suspiciousCount = submissions.filter((s: any) => 
    s.similarityScore > 0.7
  ).length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Rendus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {submissions.length}/{totalGroups}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPercent(totalGroups > 0 ? submissions.length / totalGroups : 0)} des groupes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
            <FileCheck className="h-4 w-4 text-green-600" />
            Dans les délais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">
            {onTimeCount}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPercent(submissions.length > 0 ? onTimeCount / submissions.length : 0)} des rendus
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            En retard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-orange-600">
            {lateCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Pénalité : {formatDecimal(deliverable.penaltyPerHour)} pt/h
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Similarité élevée
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">
            {suspiciousCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Plus de 70 % de similarité
          </p>
        </CardContent>
      </Card>
    </div>
  )
}