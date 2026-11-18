"use client"
import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User, AuthContextType } from "@/types/auth"
import { saveToken, saveUser, clearAppState } from "./appState"
import { useRouter } from "next/navigation"
import { bootstrapDemo } from "@/lib/demo/install"

// Installe l'intercepteur fetch de la démo statique avant tout appel API.
bootstrapDemo()

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
const Route = useRouter();
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token")
      const storedUser = localStorage.getItem("user")
      if (storedUser && token) {
        setUser(JSON.parse(storedUser))
        await verifyToken()
      } else {
        setUser(null)
      }
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const verifyToken = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return false

      const response = await fetch(`${baseURL}/api/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Token invalid")
      }

      return true
    } catch (error) {
      
      return await refreshToken()
    }
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Login failed" }))
        throw new Error(errorData.error || "Login failed")
      }

      const data = await response.json()
      
      if (!data.token || !data.refreshToken) {
        throw new Error("No token received from server")
      }

      const user = data.user
      saveUser(user)
      saveToken(data.token)
      setUser(user)
      
      localStorage.setItem("user", JSON.stringify(user))
      localStorage.setItem("token", data.token)
      localStorage.setItem("refreshToken", data.refreshToken)
      if(user.role === "teacher"){
        Route.push("/promotions");
      } else {
        Route.push("/my-projects");
      }

    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      setIsRefreshing(true)
      const refreshToken = localStorage.getItem("refreshToken")
      
      if (!refreshToken) {
        throw new Error("No refresh token available")
      }

      const response = await fetch(`${baseURL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.token) {
          localStorage.setItem("token", data.token)
          saveToken(data.token)
          if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken)
          
          // Mettre à jour les données utilisateur si fournies
          if (data.user) {
            setUser(data.user)
            saveUser(data.user)
            localStorage.setItem("user", JSON.stringify(data.user))
          }
          
          return true
        }
      }
      
      // Si le refresh échoue, déconnecter
      throw new Error("Refresh failed")
      
    } catch (error) {
      logout()
      return false
    } finally {
      setIsRefreshing(false)
    }
  }

  const logout = () => {
    clearAppState()
    setUser(null)
    localStorage.removeItem("user")
    localStorage.removeItem("token")
    localStorage.removeItem("refreshToken")
    localStorage.removeItem("firstName");
    localStorage.removeItem("lastName");
  }

  // Rafraîchissement automatique périodique
  useEffect(() => {
    if (!user) return

    const refreshInterval = setInterval(async () => {
      const token = localStorage.getItem("token")
      if (token) {
        try {
          // Vérifier si le token expire bientôt (dans 5 minutes)
          const payload = JSON.parse(atob(token.split('.')[1]))
          const exp = payload.exp * 1000
          const now = Date.now()
          const fiveMinutes = 5 * 60 * 1000

          if (exp - now < fiveMinutes) {
            await refreshToken()
          }
        } catch (error) {
        }
      }
    }, 60 * 1000) // Vérifier toutes les minutes

    return () => clearInterval(refreshInterval)
  }, [user])

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    isRefreshing,
    refreshToken,
    checkAuth
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
