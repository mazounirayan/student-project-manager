"use client"

import { useState, type FormEvent } from "react"
import { BookOpen, FileCheck2, GraduationCap, Loader2, LogIn, Users, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { DEMO_ACCOUNTS, STATIC_DEMO } from "@/lib/demo/mode"
import { DemoBanner } from "@/components/demo/demo-banner"

const DEMO_CHOICES: Array<{ account: (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS]; icon: LucideIcon }> = [
  { account: DEMO_ACCOUNTS.teacher, icon: GraduationCap },
  { account: DEMO_ACCOUNTS.student, icon: Users },
]

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<{ source: "demo" | "form"; message: string } | null>(null)
  const [pending, setPending] = useState(false)
  const { login } = useAuth()

  const signIn = async (source: "demo" | "form", accountEmail: string, accountPassword: string, fallback: string) => {
    setError(null)
    setPending(true)
    try {
      await login(accountEmail, accountPassword)
    } catch (err) {
      setError({ source, message: errorMessage(err, fallback) })
      setPending(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    signIn("form", email, password, "Connexion impossible. Vérifiez vos identifiants et la disponibilité du service.")
  }

  // En démo, le mot de passe n’est pas vérifié : connexion en un clic.
  const loginAs = (accountEmail: string) =>
    signIn("demo", accountEmail, "demo", "Connexion démo impossible. Réinitialisez la démo puis réessayez.")

  const errorBlock = (source: "demo" | "form") =>
    error?.source === source && (
      <p role="alert" className="mb-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {error.message}
      </p>
    )

  const emailForm = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorBlock("form")}
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="prenom.nom@example.org" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" />
            Connexion en cours…
          </>
        ) : (
          "Se connecter"
        )}
      </Button>
    </form>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DemoBanner />
      <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="hidden bg-primary p-16 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <p className="flex items-center gap-3 text-lg font-semibold">
            <BookOpen aria-hidden="true" className="h-7 w-7" />
            Gestionnaire de projets
          </p>
          <div className="max-w-lg">
            <p className="text-4xl font-semibold leading-tight tracking-tight">Un espace commun pour vos projets étudiants.</p>
            <p className="mt-6 text-lg leading-relaxed text-primary-foreground/85">
              De la constitution des équipes à l’évaluation, retrouvez les étapes du projet dans le même espace.
            </p>
            <ul className="mt-10 space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <Users aria-hidden="true" className="h-5 w-5 shrink-0" />
                Promotions, projets et groupes
              </li>
              <li className="flex items-center gap-3">
                <FileCheck2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                Livrables, rapports, soutenances et grilles de notation
              </li>
            </ul>
          </div>
          <p className="text-sm text-primary-foreground/75">Espace enseignants et étudiants</p>
        </section>

        <section className="flex items-start justify-center px-5 py-10 sm:items-center sm:px-12">
          <div className="w-full max-w-md">
            <p className="mb-8 flex items-center gap-2 text-base font-semibold text-primary lg:hidden">
              <BookOpen aria-hidden="true" className="h-5 w-5" />
              Gestionnaire de projets
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {STATIC_DEMO ? "Essayez la démo" : "Retrouvez votre espace"}
            </h1>
            <p className="mb-6 mt-2 text-muted-foreground">
              {STATIC_DEMO
                ? "Choisissez un rôle pour parcourir l’application avec des données fictives, sans mot de passe."
                : "Connectez-vous avec votre compte pédagogique."}
            </p>

            {STATIC_DEMO ? (
              <>
                {errorBlock("demo")}
                <div className="grid gap-3">
                  {DEMO_CHOICES.map(({ account, icon: Icon }) => (
                    <button
                      key={account.email}
                      type="button"
                      disabled={pending}
                      onClick={() => loginAs(account.email)}
                      className="flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left outline-none transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
                    >
                      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {account.name} <span className="font-normal text-muted-foreground">· {account.label}</span>
                        </span>
                        <span className="mt-1 block text-sm leading-snug text-muted-foreground">{account.description}</span>
                      </span>
                      {pending ? (
                        <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <LogIn aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
                <details open={error?.source === "form"} className="mt-6 rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm font-medium">Utiliser une adresse e-mail</summary>
                  <p className="mb-4 mt-2 text-xs leading-relaxed text-muted-foreground">
                    Seules les deux adresses de démonstration sont reconnues, par exemple {DEMO_ACCOUNTS.teacher.email}.
                  </p>
                  {emailForm}
                </details>
              </>
            ) : (
              <>
                {emailForm}
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                  Pas encore de compte ? Contactez votre responsable pédagogique pour obtenir un accès.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
