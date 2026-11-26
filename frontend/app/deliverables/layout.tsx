import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Livrables" }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
