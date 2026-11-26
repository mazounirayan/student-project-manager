import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Mes projets" }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
