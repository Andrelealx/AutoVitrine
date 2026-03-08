import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CarFront, CreditCard, LayoutDashboard, LogOut, Settings, Shield, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

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
  { to: "/admin/planos", label: "Planos", icon: CreditCard }
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = user?.role === "SUPER_ADMIN" ? adminLinks : ownerLinks;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-base-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-white/10 bg-base-900 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-6">
            <Link to={user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard"} className="font-display text-2xl text-gold-300">
              AutoVitrine
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
              {user?.role === "SUPER_ADMIN" ? "Painel SaaS" : "Painel da loja"}
            </p>
          </div>

          <nav className="space-y-1 p-4">
            {links.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard" || item.to === "/admin"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                      isActive ? "bg-gold-400/20 text-gold-200" : "text-zinc-300 hover:bg-white/5"
                    }`
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}

            {user?.role !== "SUPER_ADMIN" && (
              <NavLink
                to="/dashboard/usuarios"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                    isActive ? "bg-gold-400/20 text-gold-200" : "text-zinc-300 hover:bg-white/5"
                  }`
                }
              >
                <Users size={16} />
                Equipe
              </NavLink>
            )}
          </nav>

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}