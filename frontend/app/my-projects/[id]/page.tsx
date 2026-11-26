import { DEMO_PRERENDERED_PROJECT_IDS } from "@/lib/demo/mode"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { StudentProjectDetailsPageContent } from "./page-content"

interface ProjectDetailsPageProps {
  params: {
    id: string
  }
}

export default function StudentProjectDetailsPage({ params }: ProjectDetailsPageProps) {
  return (
    <ProtectedRoute roles={["student"]}>
      <StudentProjectDetailsPageContent params={params} />
    </ProtectedRoute>
  )
}

/**
 * Export statique (GitHub Pages) : seuls les projets de la démo sont pré-générés.
 * En mode classique, la page reste rendue à la demande.
 */
export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO !== "1") return []
  return DEMO_PRERENDERED_PROJECT_IDS.map((id) => ({ id: String(id) }))
}
