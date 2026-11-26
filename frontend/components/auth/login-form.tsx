"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { BookOpen, FileCheck2, GraduationCap, Loader2, LogIn, Users } from "lucide-react"
import { errorMessage } from "@/lib/api"
import { DEMO_ACCOUNTS, STATIC_DEMO } from "@/lib/demo/mode"
import { DemoBanner } from "@/components/demo/demo-banner"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { login, loading } = useAuth()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    try {
      await login(email, password)
    } catch (err) {
      setError(errorMessage(err, "Connexion impossible. Vérifiez vos identifiants et la disponibilité du service."))
    }
  }

  const loginAs = async (accountEmail: string) => {
    setError("")
    try {
      // En démo, le mot de passe n’est pas vérifié : connexion en un clic.
      await login(accountEmail, "demo")
    } catch {
      setError("Connexion démo impossible. Réinitialisez la démo puis réessayez.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <main className="grid min-h-screen lg:grid-cols-2">
      <section className="bg-primary px-7 py-12 text-primary-foreground sm:px-12 lg:flex lg:flex-col lg:justify-between lg:p-16">
        <div className="flex flex-wrap items-center gap-3 text-lg font-semibold"><BookOpen aria-hidden="true" className="h-7 w-7" />Gestionnaire de projets</div>
        <div className="my-12 max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Un espace commun pour vos projets étudiants.</h1>
          <p className="mt-6 text-lg leading-relaxed text-white/85">De la constitution des équipes à l’évaluation, retrouvez les étapes du projet dans le même espace.</p>
          <div className="mt-10 space-y-5 text-sm">
            <p className="flex flex-wrap items-center gap-3"><Users aria-hidden="true" className="h-5 w-5" />Promotions, projets et groupes</p>
            <p className="flex flex-wrap items-center gap-3"><FileCheck2 aria-hidden="true" className="h-5 w-5" />Livrables, rapports et grilles de notation</p>
          </div>
        </div>
        <p className="text-sm text-white/75">Espace enseignants et étudiants</p>
      </section>
      <section className="flex items-center justify-center px-7 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-semibold tracking-tight">Retrouvez votre espace</h2>
          <p className="mb-8 mt-3 text-muted-foreground">Connectez-vous avec votre compte pédagogique.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="email">Adresse e-mail</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="prenom.nom@example.com" required /></div>
            <div className="space-y-2"><Label htmlFor="password">Mot de passe</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading}>{loading ? <><Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />Connexion en cours…</> : "Se connecter"}</Button>
          </form>

          {STATIC_DEMO && (
            <div className="mt-8 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Essayer la démo en un clic</p>
              <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
                Données fictives conservées dans votre navigateur. Aucun mot de passe nécessaire.
              </p>
              <div className="grid gap-2">
                <Button variant="outline" className="h-11 w-full justify-start" disabled={loading} onClick={() => loginAs(DEMO_ACCOUNTS.teacher.email)}>
                  <GraduationCap aria-hidden="true" className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">
                    <span className="block text-sm font-medium">{DEMO_ACCOUNTS.teacher.name}</span>
                    <span className="block text-xs text-muted-foreground">{DEMO_ACCOUNTS.teacher.description}</span>
                  </span>
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-11 w-full justify-start" disabled={loading} onClick={() => loginAs(DEMO_ACCOUNTS.student.email)}>
                  <Users aria-hidden="true" className="mr-2 h-4 w-4" />
                  <span className="flex-1 text-left">
                    <span className="block text-sm font-medium">{DEMO_ACCOUNTS.student.name}</span>
                    <span className="block text-xs text-muted-foreground">{DEMO_ACCOUNTS.student.description}</span>
                  </span>
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {STATIC_DEMO
              ? "Version de démonstration statique : le backend n’est pas requis."
              : "Pas encore de compte ? Contactez votre responsable pédagogique pour obtenir un accès."}
          </p>
        </div>
      </section>
      </main>
    </div>
  )
}
