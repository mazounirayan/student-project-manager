"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard"
import { useAuth } from "@/contexts/auth-context"

/** Accueil : ce qui demande de l’attention, selon le rôle (la connexion est gérée par MainLayout). */
export default function HomePage() {
  const { user } = useAuth()

  return (
    <MainLayout>
      {user?.role === "teacher" && <TeacherDashboard firstName={user.firstName} />}
      {user?.role === "student" && <StudentDashboard firstName={user.firstName} studentId={user.id} />}
    </MainLayout>
  )
}
