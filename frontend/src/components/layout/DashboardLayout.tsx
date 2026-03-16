import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CarFront,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { BrandLogo } from "../branding/BrandLogo";

const ownerLinks = [
  { to: "/dashboard", label: "Resumo", icon: LayoutDashboard },
  { to: "/dashboard/veiculos", label: "Veiculos", icon: CarFront },
  { to: "/dashboard/leads", label: "Leads", icon: Users },
  { to: "/dashboard/loja", label: "Personalizacao", icon: Settings },
  { to: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard }
];

const adminLinks = [
  { to: "/admin", label: "Resumo", icon: Shield },
  { to: "/admin/lojas", label: "Lojas", icon: Users },
  { to: "/admin/planos", label: "Planos", icon: CreditCard },
  { to: "/admin/auditoria", label: "Auditoria", icon: FileClock }
];

export function DashboardLayout() {
  const { user, logout, isImpersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = user?.role === "SUPER_ADMIN" ? adminLinks : ownerLinks;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function navClass(isActive: boolean) {
    return `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
      isActive ? "bg-gold-400/20 text-gold-200" : "text-zinc-300 hover:bg-white/5"
    }`;
  }

  function renderLinks(onNavigate?: () => void) {
    return (
      <>
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard" || item.to === "/admin"}
              onClick={onNavigate}
              className={({ isActive }) => navClass(isActive)}
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}

        {user?.role !== "SUPER_ADMIN" && (
          <NavLink
            to="/dashboard/usuarios"
            onClick={onNavigate}
            className={({ isActive }) => navClass(isActive)}
          >
            <Users size={16} />
            Equipe
          </NavLink>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-base-950 text-zinc-100">
      <div className="mx-auto min-h-screen max-w-[1400px] lg:grid lg:grid-cols-[280px_1fr]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-base-900/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 p-4">
            <Link to={user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}>
              <BrandLogo
                tone="gold"
                size="sm"
                subtitle={user?.role === "SUPER_ADMIN" ? "SaaS Admin" : "Painel da loja"}
              />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              className="flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-100"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
              {mobileMenuOpen ? "Fechar" : "Menu"}
            </button>
          </div>

          {mobileMenuOpen ? (
            <div className="space-y-3 border-t border-white/10 p-4">
              <nav className="space-y-1">{renderLinks(() => setMobileMenuOpen(false))}</nav>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          ) : null}
        </header>

        <aside className="hidden border-r border-white/10 bg-base-900 lg:flex lg:min-h-screen lg:flex-col">
          <div className="border-b border-white/10 p-6">
            <Link to={user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"}>
              <BrandLogo
                tone="gold"
                size="sm"
                subtitle={user?.role === "SUPER_ADMIN" ? "SaaS Admin" : "Painel da loja"}
              />
            </Link>
          </div>

          <nav className="space-y-1 p-4">{renderLinks()}</nav>

          <div className="mt-auto p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </aside>

        <main className="p-4 sm:p-6 lg:p-8">
          {isImpersonating ? (
            <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-100">
                  Sessao de suporte ativa: voce esta navegando como lojista.
                </p>
                <button
                  type="button"
                  onClick={stopImpersonation}
                  className="rounded-xl border border-amber-200/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10"
                >
                  Voltar para super admin
                </button>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
