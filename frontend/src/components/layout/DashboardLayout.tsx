import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CarFront,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
  MessageSquare
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { BrandLogo } from "../branding/BrandLogo";

const ownerLinks = [
  { to: "/dashboard", label: "Visao geral", icon: LayoutDashboard },
  { to: "/dashboard/veiculos", label: "Estoque", icon: CarFront },
  { to: "/dashboard/leads", label: "Leads", icon: MessageSquare },
  { to: "/dashboard/fiscal", label: "NF-e Fiscal", icon: FileText },
  { to: "/dashboard/loja", label: "Personalizacao", icon: Settings },
  { to: "/dashboard/usuarios", label: "Equipe", icon: Users },
  { to: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard }
];

const adminLinks = [
  { to: "/admin", label: "Visao geral", icon: Shield },
  { to: "/admin/lojas", label: "Lojas", icon: Users },
  { to: "/admin/planos", label: "Planos", icon: CreditCard },
  { to: "/admin/auditoria", label: "Auditoria", icon: FileClock }
];

export function DashboardLayout() {
  const { user, logout, isImpersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === "SUPER_ADMIN";
  const links = isAdmin ? adminLinks : ownerLinks;
  const storeSlug = user?.store?.slug;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function navClass(isActive: boolean) {
    return `group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
      isActive
        ? "border-gold-300/30 bg-gradient-to-r from-gold-400/15 to-transparent text-gold-100"
        : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-zinc-200"
    }`;
  }

  function roleLabel() {
    if (user?.role === "SUPER_ADMIN") return "Super admin";
    if (user?.role === "STORE_OWNER") return "Proprietario";
    return "Equipe";
  }

  function renderLinks(onNavigate?: () => void) {
    return links.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/dashboard" || item.to === "/admin"}
          onClick={onNavigate}
          className={({ isActive }) => navClass(isActive)}
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-3">
                <Icon size={15} />
                {item.label}
              </span>
              <ChevronRight
                size={13}
                className={isActive ? "opacity-70" : "opacity-0 group-hover:opacity-40"}
              />
            </>
          )}
        </NavLink>
      );
    });
  }

  const sidebarContent = (
    <>
      {/* Logo + loja */}
      <div className="border-b border-white/10 p-5">
        <Link to={isAdmin ? "/admin" : "/dashboard"}>
          <BrandLogo
            tone="gold"
            size="sm"
            subtitle={isAdmin ? "SaaS Admin" : "Painel da loja"}
          />
        </Link>

        {/* Info da sessão */}
        <div className="mt-4 rounded-xl border border-white/10 bg-base-950/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Sessao ativa</p>
          <p className="mt-1.5 text-sm font-semibold leading-tight text-zinc-100">{user?.name}</p>
          <p className="text-xs text-zinc-500">{roleLabel()}</p>
          {!isAdmin && user?.store?.name && (
            <p className="mt-1 truncate text-xs text-zinc-400">{user.store.name}</p>
          )}
        </div>

        {/* Link para vitrine (apenas lojista) */}
        {!isAdmin && storeSlug && (
          <a
            href={`/loja/${storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            <ExternalLink size={12} />
            Ver minha vitrine
          </a>
        )}
      </div>

      {/* Navegação */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        <p className="mb-1.5 px-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Menu</p>
        <nav className="space-y-0.5">{renderLinks()}</nav>
      </div>

      {/* Logout */}
      <div className="p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 transition hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-base-950 text-zinc-100">
      <div className="mx-auto min-h-screen max-w-[1400px] lg:grid lg:grid-cols-[260px_1fr]">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-base-900/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link to={isAdmin ? "/admin" : "/dashboard"}>
              <BrandLogo
                tone="gold"
                size="sm"
                subtitle={isAdmin ? "Admin" : user?.store?.name ?? "Painel"}
              />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-200"
            >
              {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
              {mobileMenuOpen ? "Fechar" : "Menu"}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="space-y-3 border-t border-white/10 p-4">
              {!isAdmin && storeSlug && (
                <a
                  href={`/loja/${storeSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <ExternalLink size={12} />
                  Ver vitrine
                </a>
              )}
              <nav className="space-y-0.5">{renderLinks(() => setMobileMenuOpen(false))}</nav>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                <LogOut size={15} />
                Sair
              </button>
            </div>
          )}
        </header>

        {/* Sidebar desktop */}
        <aside className="hidden border-r border-white/10 bg-base-900 lg:flex lg:min-h-screen lg:flex-col">
          {sidebarContent}
        </aside>

        {/* Conteúdo principal */}
        <main className="p-4 sm:p-6 lg:p-8">
          {isImpersonating && (
            <div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-100">
                  Sessao de suporte ativa — navegando como lojista.
                </p>
                <button
                  type="button"
                  onClick={stopImpersonation}
                  className="rounded-xl border border-amber-200/35 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-300/10"
                >
                  Voltar para super admin
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
