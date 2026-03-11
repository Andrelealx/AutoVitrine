import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { useAuth } from "./context/AuthContext";
import { AdminAuditLogsPage } from "./pages/admin/AdminAuditLogsPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminPlansPage } from "./pages/admin/AdminPlansPage";
import { AdminStoresPage } from "./pages/admin/AdminStoresPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { LeadsPage } from "./pages/dashboard/LeadsPage";
import { OwnerDashboardPage } from "./pages/dashboard/OwnerDashboardPage";
import { StoreSettingsPage } from "./pages/dashboard/StoreSettingsPage";
import { SubscriptionPage } from "./pages/dashboard/SubscriptionPage";
import { UsersPage } from "./pages/dashboard/UsersPage";
import { VehiclesPage } from "./pages/dashboard/VehiclesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { HomePage } from "./pages/public/HomePage";
import { StorefrontPage } from "./pages/public/StorefrontPage";
import { VehicleDetailsPage } from "./pages/public/VehicleDetailsPage";

function RootRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <HomePage />;
  }

  if (user.role === "SUPER_ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />
  },
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/register",
    element: <RegisterPage />
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />
  },
  {
    element: <ProtectedRoute roles={["STORE_OWNER", "STORE_STAFF"]} />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <OwnerDashboardPage />
          },
          {
            path: "veiculos",
            element: <VehiclesPage />
          },
          {
            path: "leads",
            element: <LeadsPage />
          },
          {
            path: "loja",
            element: <StoreSettingsPage />
          },
          {
            path: "assinatura",
            element: <SubscriptionPage />
          },
          {
            path: "usuarios",
            element: <UsersPage />
          }
        ]
      }
    ]
  },
  {
    element: <ProtectedRoute roles={["SUPER_ADMIN"]} />,
    children: [
      {
        path: "/admin",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <AdminOverviewPage />
          },
          {
            path: "lojas",
            element: <AdminStoresPage />
          },
          {
            path: "planos",
            element: <AdminPlansPage />
          },
          {
            path: "auditoria",
            element: <AdminAuditLogsPage />
          }
        ]
      }
    ]
  },
  {
    path: "/loja/:slug",
    element: <StorefrontPage />
  },
  {
    path: "/loja/:slug/veiculos/:vehicleId",
    element: <VehicleDetailsPage />
  },
  {
    path: "*",
    element: <NotFoundPage />
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
