"use client"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

interface ValidationResult {
  ruleId?: number
  ruleName?: string
  ruleType?: string
  passed: boolean
  message?: string
}

interface ConformityIndicatorsProps {
  results?: any // Utilisez any pour accepter différents formats
}

export function ConformityIndicators({ results }: ConformityIndicatorsProps) {
  // Fonction utilitaire pour normaliser les résultats en tableau
  const normalizeResults = (data: any): ValidationResult[] => {
    if (!data) return []
    
    // Si c'est déjà un tableau
    if (Array.isArray(data)) {
      return data
    }
    
    // Si c'est un objet avec des propriétés de règles
    if (typeof data === 'object') {
      return Object.entries(data).map(([key, value]: [string, any]) => ({
        ruleId: value.ruleId || key,
        ruleName: value.ruleName || key,
        ruleType: value.ruleType || key,
        passed: value.passed || value.valid || false,
        message: value.message || value.error
      }))
    }
    
    return []
  }

  const normalizedResults = normalizeResults(results)
  const hasResults = normalizedResults.length > 0

  if (!hasResults) {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Non vérifié
      </Badge>
    )
  }

  const passedCount = normalizedResults.filter(r => r.passed).length
  const allPassed = passedCount === normalizedResults.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge 
          variant={allPassed ? "default" : "destructive"} 
          className="cursor-pointer gap-1"
        >
          {allPassed ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {passedCount}/{normalizedResults.length} règles
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Résultats de validation</h4>
          <div className="space-y-2">
            {normalizedResults.map((result, idx) => (
              <div key={result.ruleId || `rule-${idx}`} className="flex items-start gap-2 text-sm">
                {result.passed ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={result.passed ? "text-green-700" : "text-red-700"}>
                    {result.ruleName || `Règle ${idx + 1}`}
                  </p>
                  {result.message && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}