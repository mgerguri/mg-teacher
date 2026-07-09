import { Navigate } from 'react-router-dom'
import { useAuth, Role } from '../context/AuthContext'

interface Props {
  children: React.ReactNode
  requiredRole?: Role
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
