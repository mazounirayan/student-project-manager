"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import type { AuthContextType, User } from "@/types/auth"
import { BACKEND_URL } from "@/lib/api"
import { bootstrapDemo } from "@/lib/demo/install"

// En démo statique, installe l’intercepteur fetch avant le premier appel API.
bootstrapDemo()

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function clearSession() {
  for (const key of ["user", "token", "refreshToken"]) window.localStorage.removeItem(key)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const refreshToken = useCallback(async (): Promise<boolean> => {
    setIsRefreshing(true)
    try {
      const refresh = window.localStorage.getItem("refreshToken")
      if (!refresh) throw new Error("Aucun jeton de rafraîchissement")

      const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      const data = response.ok ? await response.json() : null
      if (!data?.token) throw new Error("Rafraîchissement refusé")

      window.localStorage.setItem("token", data.token)
      if (data.refreshToken) window.localStorage.setItem("refreshToken", data.refreshToken)
      if (data.user) {
        window.localStorage.setItem("user", JSON.stringify(data.user))
        setUser(data.user)
      }
      return true
    } catch {
      logout()
      return false
    } finally {
      setIsRefreshing(false)
    }
  }, [logout])

  const checkAuth = useCallback(async () => {
    try {
      const token = window.localStorage.getItem("token")
      const storedUser = window.localStorage.getItem("user")
      if (!token || !storedUser) {
        setUser(null)
        return
      }
      setUser(JSON.parse(storedUser))

      const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) await refreshToken()
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [refreshToken])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Rafraîchit le jeton quand il expire dans moins de cinq minutes (jetons JWT du backend).
  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => {
      try {
        const token = window.localStorage.getItem("token")
        if (!token) return
        const { exp } = JSON.parse(atob(token.split(".")[1]))
        if (exp * 1000 - Date.now() < 5 * 60 * 1000) refreshToken()
      } catch {
        // jeton non JWT (démo) : rien à rafraîchir
      }
    }, 60 * 1000)
    return () => clearInterval(timer)
  }, [user, refreshToken])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || "Connexion impossible")
      }

      const data = await response.json()
      if (!data.token || !data.refreshToken) throw new Error("Réponse de connexion incomplète")

      window.localStorage.setItem("user", JSON.stringify(data.user))
      window.localStorage.setItem("token", data.token)
      window.localStorage.setItem("refreshToken", data.refreshToken)
      setUser(data.user)
      router.push(data.user.role === "teacher" ? "/promotions" : "/my-projects")
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextType = { user, login, logout, loading, isRefreshing, refreshToken, checkAuth }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider")
  }
  return context
}
