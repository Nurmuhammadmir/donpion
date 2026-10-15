import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-graphite">Загрузка…</div>;
  }

  if (!admin) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
