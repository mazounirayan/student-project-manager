"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MainLayout } from "@/components/layout/main-layout"
import { navFor } from "@/components/layout/nav"
import { useAuth } from "@/contexts/auth-context"

export default function HomePage() {
  const { user } = useAuth()
  const teacher = user?.role === "teacher"

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl p-6 sm:p-10">
        <header className="mb-10 border-b pb-8">
          <p className="mb-3 text-sm text-primary">Espace {teacher ? "enseignant" : "étudiant"}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Bonjour{user?.firstName ? ` ${user.firstName}` : ""}
          </h1>
        </header>

        <nav aria-label="Pages principales" className="grid gap-4 sm:grid-cols-2">
          {navFor(user?.role).map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-wrap items-start gap-4 rounded-lg border bg-card p-6 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{label}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </div>
              <ArrowRight aria-hidden="true" className="mt-1 h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      </div>
    </MainLayout>
  )
}
