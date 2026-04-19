import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { useAuth } from "./context/AuthContext";

// Páginas públicas — carregadas imediatamente (visitantes chegam aqui primeiro)
import { HomePage } from "./pages/public/HomePage";
import { StorefrontPage } from "./pages/public/StorefrontPage";
import { VehicleDetailsPage } from "./pages/public/VehicleDetailsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Auth
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";

// Dashboard — lazy loaded: só usuários logados precisam desses chunks
const OwnerDashboardPage = lazy(() =>
  import("./pages/dashboard/OwnerDashboardPage").then((m) => ({ default: m.OwnerDashboardPage }))
);
const VehiclesPage = lazy(() =>
  import("./pages/dashboard/VehiclesPage").then((m) => ({ default: m.VehiclesPage }))
);
const LeadsPage = lazy(() =>
  import("./pages/dashboard/LeadsPage").then((m) => ({ default: m.LeadsPage }))
);
const StoreSettingsPage = lazy(() =>
  import("./pages/dashboard/StoreSettingsPage").then((m) => ({ default: m.StoreSettingsPage }))
);
const SubscriptionPage = lazy(() =>
  import("./pages/dashboard/SubscriptionPage").then((m) => ({ default: m.SubscriptionPage }))
);
const UsersPage = lazy(() =>
  import("./pages/dashboard/UsersPage").then((m) => ({ default: m.UsersPage }))
);

// Admin — lazy loaded: usado por pouquíssimas pessoas
const AdminOverviewPage = lazy(() =>
  import("./pages/admin/AdminOverviewPage").then((m) => ({ default: m.AdminOverviewPage }))
);
const AdminStoresPage = lazy(() =>
  import("./pages/admin/AdminStoresPage").then((m) => ({ default: m.AdminStoresPage }))
);
const AdminPlansPage = lazy(() =>
  import("./pages/admin/AdminPlansPage").then((m) => ({ default: m.AdminPlansPage }))
);
const AdminAuditLogsPage = lazy(() =>
  import("./pages/admin/AdminAuditLogsPage").then((m) => ({ default: m.AdminAuditLogsPage }))
);

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950">
      <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
            element: (
              <Suspense fallback={<PageLoader />}>
                <OwnerDashboardPage />
              </Suspense>
            )
          },
          {
            path: "veiculos",
            element: (
              <Suspense fallback={<PageLoader />}>
                <VehiclesPage />
              </Suspense>
            )
          },
          {
            path: "leads",
            element: (
              <Suspense fallback={<PageLoader />}>
                <LeadsPage />
              </Suspense>
            )
          },
          {
            path: "loja",
            element: (
              <Suspense fallback={<PageLoader />}>
                <StoreSettingsPage />
              </Suspense>
            )
          },
          {
            path: "assinatura",
            element: (
              <Suspense fallback={<PageLoader />}>
                <SubscriptionPage />
              </Suspense>
            )
          },
          {
            path: "usuarios",
            element: (
              <Suspense fallback={<PageLoader />}>
                <UsersPage />
              </Suspense>
            )
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
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminOverviewPage />
              </Suspense>
            )
          },
          {
            path: "lojas",
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminStoresPage />
              </Suspense>
            )
          },
          {
            path: "planos",
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminPlansPage />
              </Suspense>
            )
          },
          {
            path: "auditoria",
            element: (
              <Suspense fallback={<PageLoader />}>
                <AdminAuditLogsPage />
              </Suspense>
            )
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
