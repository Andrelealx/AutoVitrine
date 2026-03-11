import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Lead, PlanUsage } from "../../lib/types";

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

export function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/stores/me/dashboard")
      .then((response) => setData(response.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-zinc-400">Carregando dashboard...</p>;
  }

  if (!data) {
    return <p className="text-red-400">Nao foi possivel carregar os dados.</p>;
  }

  const stats = [
    {
      label: "Total de veiculos",
      value: data.metrics.totalVehicles
    },
    {
      label: "Disponiveis",
      value: data.metrics.availableVehicles
    },
    {
      label: "Vendidos",
      value: data.metrics.soldVehicles
    },
    {
      label: "Leads recebidos",
      value: data.metrics.leadsCount
    },
    {
      label: "Visualizacoes da vitrine",
      value: data.metrics.viewsCount
    }
  ];

  const trialEndsAt = data.planUsage?.trial?.trialEndsAt;
  const trialDaysLeft =
    data.planUsage?.trial?.isTrialing && trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-gold-300">Resumo da loja</h1>
          <p className="mt-2 text-sm text-zinc-400">Acompanhe performance, leads e estoque.</p>
        </div>
        <Link
          to="/dashboard/veiculos"
          className="rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
        >
          Adicionar veiculo
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <article key={item.label} className="rounded-2xl border border-white/10 bg-base-900 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Uso do plano</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">Veiculos</p>
            <p>
              {data.planUsage.usage.vehicles.used} / {data.planUsage.usage.vehicles.limit ?? "Ilimitado"}
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">Usuarios</p>
            <p>
              {data.planUsage.usage.users.used} / {data.planUsage.usage.users.limit ?? "Ilimitado"}
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
            <p className="text-xs text-zinc-500">Fotos por veiculo</p>
            <p>{data.planUsage.usage.photosPerVehicle.limit ?? "Ilimitado"}</p>
          </article>
        </div>

        {trialDaysLeft !== null ? (
          <p className="mt-3 text-sm text-amber-200">
            Seu trial termina em {trialDaysLeft} dia(s). Considere fazer upgrade para nao ser suspenso.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-gold-300">Leads recentes</h2>

        <div className="mt-4 space-y-3">
          {data.latestLeads.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum lead recebido ainda.</p>
          ) : (
            data.latestLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-white/10 bg-base-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100">{lead.name}</p>
                  <p className="text-xs text-zinc-500">{new Date(lead.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <p className="text-sm text-zinc-300">{lead.phone}</p>
                <p className="mt-2 text-sm text-zinc-400">{lead.message}</p>
                {lead.vehicle ? (
                  <p className="mt-2 text-xs text-gold-300">
                    Interesse em {lead.vehicle.brand} {lead.vehicle.model} ({lead.vehicle.year})
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
