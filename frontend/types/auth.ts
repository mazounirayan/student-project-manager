export interface User {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string
  isActive: boolean
  role: "teacher" | "student"
  createdAt: Date
  updatedAt: Date
}

export interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  isRefreshing: boolean
  refreshToken: () => Promise<boolean>
  checkAuth: () => Promise<void>
}

export interface LoginCredentials {
  email: string
  password: string
}
