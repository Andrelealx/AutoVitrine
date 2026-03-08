import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type ProtectedRouteProps = {
  roles?: Array<"SUPER_ADMIN" | "STORE_OWNER" | "STORE_STAFF">;
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 text-gold-300">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  return <Outlet />;
}