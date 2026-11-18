"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock, AlertCircle, CheckCircle } from "lucide-react"

interface SubmissionStatusProps {
  submission: any
  deliverable: any
}

export function SubmissionStatus({ submission, deliverable }: SubmissionStatusProps) {
  if (!submission.submittedAt) {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Non soumis
      </Badge>
    )
  }

  const submittedAt = new Date(submission.submittedAt)
  const deadline = new Date(deliverable.deadline)
  const isLate = submittedAt > deadline

  if (!isLate) {
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        À temps
      </Badge>
    )
  }

  // Calcul du retard et de la pénalité
  const hoursLate = Math.ceil((submittedAt.getTime() - deadline.getTime()) / (1000 * 60 * 60))
  const penalty = hoursLate * (deliverable.penaltyPerHour || 0)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            Retard: -{penalty.toFixed(1)}pts
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Soumis {hoursLate}h en retard</p>
          <p className="text-xs text-muted-foreground">
            ({deliverable.penaltyPerHour}pt/h)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}