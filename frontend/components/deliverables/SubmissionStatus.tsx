"use client"

import { formatNumber, formatDecimal } from "@/lib/format"
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
        Non rendu
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
        Dans les délais
      </Badge>
    )
  }

  const hoursLate = Math.ceil((submittedAt.getTime() - deadline.getTime()) / (1000 * 60 * 60))
  const penalty = hoursLate * (deliverable.penaltyPerHour || 0)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            Retard : −{formatNumber(penalty, 1)} pts
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Rendu avec {hoursLate} h de retard</p>
          <p className="text-xs text-muted-foreground">
            ({formatDecimal(deliverable.penaltyPerHour)} pt/h)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}