import { CheckCircle2, XCircle } from "lucide-react"
import { describeRule, type RuleResult } from "@/lib/deliverables"

/** Résultat de chaque règle de conformité : ce qui était demandé, si c’est respecté, et pourquoi sinon. */
export function RuleResults({ results }: { results: RuleResult[] }) {
  return (
    <ul className="space-y-2">
      {results.map((result, index) => (
        <li key={`${result.type}-${index}`} className="flex items-start gap-2.5 text-sm">
          {result.passed ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {describeRule(result)}
              <span className="sr-only">{result.passed ? " : respectée" : " : non respectée"}</span>
            </p>
            {result.message && <p className="text-muted-foreground">{result.message}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
