import { ProtectedRoute } from "@/components/auth/protected-route"
import { GroupDetailsPageContent } from "./page-content"

interface GroupDetailsPageProps {
  params: {
    id: string
  }
}

export default function GroupDetailsPage({ params }: GroupDetailsPageProps) {
  return (
    <ProtectedRoute roles={["student"]}>
      <GroupDetailsPageContent params={params} />
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
