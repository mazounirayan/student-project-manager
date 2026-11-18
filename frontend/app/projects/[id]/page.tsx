import { ProtectedRoute } from "@/components/auth/protected-route"
import { ProjectPageContent } from "./page-content"

interface ProjectPageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <ProjectPageContent params={params} />
    </ProtectedRoute>
  )
}

/**
 * Export statique (GitHub Pages) : seuls les projets de la démo sont pré-générés.
 * En mode classique, la page reste rendue à la demande.
 */
export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO !== "1") return []
  return [{ id: "1" }, { id: "2" }]
}
