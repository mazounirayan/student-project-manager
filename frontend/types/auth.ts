export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  role: "teacher" | "student"
  createdAt: string
  updatedAt: string
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
