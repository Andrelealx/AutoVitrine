import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  CheckCircle,
  Clock,
  ExternalLink,
  MessageSquare,
  Plus,
  TrendingUp,
  Users,
  Eye,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import { api } from "../../lib/api";
import { Lead, PlanUsage } from "../../lib/types";
import { useAuth } from "../../context/AuthContext";

type DashboardResponse = {
  metrics: {
    totalVehicles: number;
    availableVehicles: number;
    soldVehicles: number;
    leadsCount: number;
    viewsCount: number;
  };
  latestLeads: Lead[];
  planUsage: PlanUsage;
};

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
  to
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: boolean;
  to?: string;
}) {
  const inner = (
    <article
      className={`group relative overflow-hidden rounded-2xl border p-5 transition ${
        accent
          ? "border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-transparent"
          : "border-white/10 bg-base-900 hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`rounded-xl p-2 ${
            accent ? "bg-gold-400/15 text-gold-300" : "bg-white/5 text-zinc-400"
          }`}
        >
          <Icon size={18} />
        </div>
        {to && (
          <ChevronRight
            size={14}
            className="opacity-0 transition group-hover:opacity-60 text-zinc-400"
          />
        )}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-100">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </article>
  );

  if (to) {
    return <Link to={to}>{inner}</Link>;
  }
  return inner;
}

function UsageBar({ used, limit, label }: { used: number; limit: number | null; label: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const warning = pct >= 80;
  const critical = pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={critical ? "text-red-400" : warning ? "text-amber-400" : "text-zinc-400"}>
          {used} / {limit ?? "∞"}
        </span>
      </div>
      {limit ? (
        <div className="h-1.5 w-full rounded-full bg-white/10">
          <div
            className={`h-1.5 rounded-full transition-all ${
              critical ? "bg-red-500" : warning ? "bg-amber-400" : "bg-gold-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-gold-400/20" />
      )}
    </div>
  );
}

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 3;
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 ${
        urgent
          ? "border-red-400/30 bg-red-500/10"
          : "border-amber-400/30 bg-amber-500/10"
      }`}
    >
      <AlertTriangle
        size={20}
        className={urgent ? "shrink-0 text-red-400" : "shrink-0 text-amber-400"}
      />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${urgent ? "text-red-200" : "text-amber-200"}`}>
          {urgent ? `Apenas ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""} de trial` : `Trial termina em ${daysLeft} dias`}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Assine um plano para continuar usando a AutoVitrine sem interrupcoes.
        </p>
      </div>
      <Link
        to="/dashboard/assinatura"
        className="shrink-0 rounded-xl bg-gold-400 px-4 py-2 text-xs font-semibold text-base-950 transition hover:bg-gold-300"
      >
        Ver planos
      </Link>
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const whatsappHref = lead.phone
    ? `https://wa.me/55${lead.phone.replace(/\D/g, "")}`
    : null;

  return (
    <div className="group flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-base-950/50 p-4 transition hover:border-white/20">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-100">{lead.name}</p>
          {lead.vehicle && (
            <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-2 py-0.5 text-[10px] text-gold-300">
              {lead.vehicle.brand} {lead.vehicle.model}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">{lead.phone}</p>
        <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{lead.message}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-[10px] text-zinc-600">
          {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
        </p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <MessageSquare size={11} />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function OwnerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const store = user?.store;

  useEffect(() => {
    api
      .get("/stores/me/dashboard")
      .then((response) => setData(response.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
        Nao foi possivel carregar os dados. Recarregue a pagina.
      </div>
    );
  }

  const trialEndsAt = data.planUsage?.trial?.trialEndsAt;
  const trialDaysLeft =
    data.planUsage?.trial?.isTrialing && trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

  const storeUrl = store?.slug ? `/loja/${store.slug}` : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Bem-vindo de volta</p>
          <h1 className="mt-1 font-display text-3xl text-zinc-100">{user?.name}</h1>
          {store?.name && (
            <p className="mt-1 text-sm text-zinc-400">{store.name}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/30 hover:text-zinc-100"
            >
              <ExternalLink size={14} />
              Ver vitrine
            </a>
          )}
          <Link
            to="/dashboard/veiculos"
            className="flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
          >
            <Plus size={15} />
            Novo veiculo
          </Link>
        </div>
      </header>

      {/* Trial banner */}
      {trialDaysLeft !== null && <TrialBanner daysLeft={trialDaysLeft} />}

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Veiculos disponiveis"
          value={data.metrics.availableVehicles}
          icon={Car}
          accent
          to="/dashboard/veiculos"
        />
        <StatCard
          label="Total no estoque"
          value={data.metrics.totalVehicles}
          icon={TrendingUp}
          to="/dashboard/veiculos"
        />
        <StatCard
          label="Vendidos"
          value={data.metrics.soldVehicles}
          icon={CheckCircle}
          to="/dashboard/veiculos"
        />
        <StatCard
          label="Leads recebidos"
          value={data.metrics.leadsCount}
          icon={Users}
          to="/dashboard/leads"
        />
        <StatCard
          label="Visualizacoes"
          value={data.metrics.viewsCount}
          icon={Eye}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Leads recentes */}
        <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-gold-300">Leads recentes</h2>
            <Link
              to="/dashboard/leads"
              className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-zinc-200"
            >
              Ver todos
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {data.latestLeads.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <MessageSquare size={32} className="text-zinc-700" />
                <p className="text-sm text-zinc-500">
                  Nenhum lead ainda. Compartilhe o link da sua vitrine.
                </p>
                {storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gold-400 hover:underline"
                  >
                    Abrir vitrine &rarr;
                  </a>
                )}
              </div>
            ) : (
              data.latestLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
            )}
          </div>
        </section>

        {/* Painel lateral — uso do plano + ações rápidas */}
        <div className="space-y-4">
          {/* Uso do plano */}
          <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Uso do plano</h2>
              <Link
                to="/dashboard/assinatura"
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Gerenciar
              </Link>
            </div>

            <div className="mt-4 space-y-4">
              <UsageBar
                label="Veiculos"
                used={data.planUsage.usage.vehicles.used}
                limit={data.planUsage.usage.vehicles.limit}
              />
              <UsageBar
                label="Usuarios da equipe"
                used={data.planUsage.usage.users.used}
                limit={data.planUsage.usage.users.limit}
              />
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Fotos por veiculo</span>
                  <span className="text-zinc-300">
                    {data.planUsage.usage.photosPerVehicle.limit
                      ? `ate ${data.planUsage.usage.photosPerVehicle.limit}`
                      : "Ilimitadas"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Acoes rapidas */}
          <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <h2 className="text-sm font-semibold text-zinc-200">Acoes rapidas</h2>
            <div className="mt-3 space-y-1">
              {[
                { to: "/dashboard/veiculos", icon: Car, label: "Gerenciar estoque" },
                { to: "/dashboard/leads", icon: MessageSquare, label: "Ver todos os leads" },
                { to: "/dashboard/loja", icon: Clock, label: "Personalizar loja" },
                { to: "/dashboard/usuarios", icon: Users, label: "Gerenciar equipe" }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-zinc-100"
                  >
                    <Icon size={15} className="text-zinc-500" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
