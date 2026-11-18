"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"

interface ValidationRule {
  type: string
  configuration?: string
  passed?: boolean
  message?: string
}

interface ValidationResultsProps {
  rules: ValidationRule[]
  isValidating: boolean
}

export function ValidationResults({ rules, isValidating }: ValidationResultsProps) {
  if (isValidating) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          Validation en cours...
        </AlertDescription>
      </Alert>
    )
  }

  if (!rules || rules.length === 0) {
    return null
  }

  const allPassed = rules.every(r => r.passed)
  const failedCount = rules.filter(r => !r.passed).length

  return (
    <Card className={allPassed ? "border-green-500" : "border-red-500"}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {allPassed ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700">Validation réussie</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700">{failedCount} règle{failedCount > 1 ? 's' : ''} non respectée{failedCount > 1 ? 's' : ''}</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.map((rule, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              rule.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            {rule.passed ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <p className={`text-sm font-medium ${rule.passed ? 'text-green-900' : 'text-red-900'}`}>
                {getRuleLabel(rule.type)}
                {rule.configuration && ` (${rule.configuration})`}
              </p>
              {rule.message && (
                <p className={`text-xs ${rule.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {rule.message}
                </p>
              )}
            </div>
          </div>
        ))}
        
        {!allPassed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Veuillez corriger les erreurs avant de soumettre votre livrable.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function getRuleLabel(type: string): string {
  const labels: Record<string, string> = {
    'max_size': 'Taille maximale',
    'required_files': 'Fichiers requis',
    'forbidden_files': 'Fichiers interdits',
    'folder_structure': 'Structure des dossiers',
    'file_content_text': 'Contenu texte',
    'file_content_regex': 'Format du contenu'
  }
  return labels[type] || type
}