/**
 * Mode démo statique (GitHub Pages, sans backend).
 * Activé à la construction avec NEXT_PUBLIC_STATIC_DEMO=1.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1"

/** Clé localStorage de la base de démo. */
export const DEMO_DB_KEY = "spm-demo-db-v1"

/** Comptes de démonstration (données fictives, domaine example réservé). */
export const DEMO_ACCOUNTS = {
  teacher: {
    email: "camille.fabre@demo.example",
    name: "Camille Fabre",
    label: "Enseignante",
    description: "Gère promotions, projets, livrables et notes.",
  },
  student: {
    email: "alex.moret@demo.example",
    name: "Alex Moret",
    label: "Étudiant",
    description: "Membre du Groupe 1, avec livrables à rendre.",
  },
} as const
