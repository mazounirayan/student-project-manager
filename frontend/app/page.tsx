"use client"

import Link from "next/link"
import { MainLayout } from "@/components/layout/main-layout"
import { useAuth } from "@/contexts/auth-context"
import { BookOpen, Users, FileText, BarChart3, ArrowRight } from "lucide-react"

export default function HomePage() {
  const { user } = useAuth()
  const teacher = user?.role === "teacher"
  const actions = teacher ? [
    { href: "/promotions", title: "Promotions", description: "Organisez les cohortes et leurs étudiants.", icon: Users },
    { href: "/projects", title: "Projets", description: "Définissez les objectifs et les équipes.", icon: BookOpen },
    { href: "/deliverables", title: "Livrables", description: "Consultez les dépôts et les échéances.", icon: FileText },
    { href: "/grading", title: "Évaluations", description: "Retrouvez les grilles de notation.", icon: BarChart3 },
  ] : [
    { href: "/my-projects", title: "Mes projets", description: "Retrouvez les consignes de vos projets.", icon: BookOpen },
    { href: "/my-group", title: "Mon groupe", description: "Consultez votre équipe de travail.", icon: Users },
    { href: "/my-deliverables", title: "Mes livrables", description: "Préparez et suivez vos dépôts.", icon: FileText },
    { href: "/my-grades", title: "Mes notes", description: "Consultez les évaluations disponibles.", icon: BarChart3 },
  ]
  return <MainLayout><div className="mx-auto max-w-5xl p-6 sm:p-10">
    <header className="mb-10 border-b pb-8"><p className="mb-3 text-sm text-primary">Espace {teacher ? "enseignant" : "étudiant"}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bienvenue{user?.firstName ? `, ${user.firstName}` : ""}</h1><p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">Choisissez un espace pour poursuivre votre travail. Les projets, livrables et évaluations sont disponibles dans leurs pages dédiées.</p></header>
    <nav aria-label="Espaces de travail" className="grid gap-4 sm:grid-cols-2">{actions.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="group flex items-start gap-4 rounded-lg border bg-card p-6 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" /><div className="flex-1"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div><ArrowRight aria-hidden="true" className="mt-1 h-5 w-5 text-muted-foreground" /></Link>)}</nav>
  </div></MainLayout>
}
