"use client"

import { useCallback, useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, User, UserCheck, Users, UserX } from "lucide-react"
import { toast } from "sonner"
import { userService, type AppUser } from "@/services/UserService"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"

export default function UsersPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <UsersPageContent />
    </ProtectedRoute>
  )
}

function UsersPageContent() {
  const [students, setStudents] = useState<AppUser[]>([])
  const [teachers, setTeachers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [pendingDeactivate, setPendingDeactivate] = useState<AppUser | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsData, teachersData] = await Promise.all([
        userService.getAllStudents(),
        userService.getAllTeachers(),
      ])
      setStudents(studentsData)
      setTeachers(teachersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement des utilisateurs.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) return
    const target = pendingDeactivate
    try {
      await userService.deactivate(target.id)
      setStudents((prev) => prev.map((u) => (u.id === target.id ? { ...u, isActive: false } : u)))
      setTeachers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isActive: false } : u)))
      toast.success("Utilisateur désactivé.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la désactivation.")
    } finally {
      setPendingDeactivate(null)
    }
  }

  const all = [...teachers, ...students]
  const query = search.trim().toLowerCase()
  const filter = (list: AppUser[]) =>
    query
      ? list.filter(
          (u) =>
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query),
        )
      : list

  const renderTable = (users: AppUser[]) => {
    const rows = filter(users)
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title={query ? "Aucun utilisateur ne correspond à cette recherche" : "Aucun utilisateur"}
          description={query ? "Essayez un autre nom ou une autre adresse e-mail." : "Les comptes apparaîtront ici après inscription."}
        />
      )
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {u.firstName?.[0]}
                      {u.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {u.firstName} {u.lastName}
                  </span>
                </div>
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === "teacher" ? "default" : "secondary"}>
                  {u.role === "teacher" ? "Enseignant" : "Étudiant"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {u.isActive ? (
                    <UserCheck aria-hidden="true" className="h-4 w-4 text-green-600" />
                  ) : (
                    <UserX aria-hidden="true" className="h-4 w-4 text-red-600" />
                  )}
                  <Badge variant={u.isActive ? "secondary" : "destructive"}>
                    {u.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {u.isActive && (
                  <Button variant="ghost" size="sm" onClick={() => setPendingDeactivate(u)}>
                    Désactiver
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">Enseignants et étudiants inscrits.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <h3 className="mt-1 text-3xl font-bold">{all.length}</h3>
              </div>
              <User aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Enseignants</p>
                <h3 className="mt-1 text-3xl font-bold">{teachers.length}</h3>
              </div>
              <UserCheck aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Étudiants</p>
                <h3 className="mt-1 text-3xl font-bold">{students.length}</h3>
              </div>
              <Users aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Liste des utilisateurs</CardTitle>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Chargement en cours">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={fetchUsers} />
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="all">Tous ({all.length})</TabsTrigger>
                  <TabsTrigger value="teachers">Enseignants ({teachers.length})</TabsTrigger>
                  <TabsTrigger value="students">Étudiants ({students.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-4">
                  {renderTable(all)}
                </TabsContent>
                <TabsContent value="teachers" className="mt-4">
                  {renderTable(teachers)}
                </TabsContent>
                <TabsContent value="students" className="mt-4">
                  {renderTable(students)}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => { if (!open) setPendingDeactivate(null) }}
        onConfirm={confirmDeactivate}
        title="Désactiver cet utilisateur ?"
        description={`${pendingDeactivate?.firstName ?? ""} ${pendingDeactivate?.lastName ?? ""} ne pourra plus se connecter tant que son compte restera désactivé.`}
        confirmText="Désactiver"
        variant="destructive"
      />
    </MainLayout>
  )
}
