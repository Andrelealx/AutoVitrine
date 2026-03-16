import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

type AdminStats = {
  totalStores: number;
  activeStores: number;
  totalVehicles: number;
  totalLeads: number;
  activeSubscriptions: number;
  mrrCents: number;
  monthlyRevenueCents: number;
  churnRate: number;
  newSubscriptionsThisMonth: number;
  newTrialsThisMonth: number;
  canceledThisMonth: number;
};

export function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.get("/admin/stats").then((response) => setStats(response.data));
  }, []);

  if (!stats) {
    return <p className="text-zinc-400">Carregando estatisticas...</p>;
  }

  const cards = [
    { label: "Lojas totais", value: stats.totalStores },
    { label: "Lojas ativas", value: stats.activeStores },
    { label: "Veiculos na plataforma", value: stats.totalVehicles },
    { label: "Leads gerados", value: stats.totalLeads },
    { label: "Assinaturas ativas", value: stats.activeSubscriptions },
    { label: "MRR", value: formatCurrency(stats.mrrCents / 100) },
    { label: "Receita no mes", value: formatCurrency(stats.monthlyRevenueCents / 100) },
    { label: "Novas assinaturas", value: stats.newSubscriptionsThisMonth },
    { label: "Novos trials", value: stats.newTrialsThisMonth },
    { label: "Canceladas no mes", value: stats.canceledThisMonth },
    { label: "Churn", value: `${stats.churnRate}%` }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-gold-300 sm:text-4xl">Painel do Super Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">Visao geral da operacao SaaS AutoVitrine.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-white/10 bg-base-900 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{card.label}</p>
            <p className="mt-2 break-words text-2xl font-semibold text-zinc-100 sm:text-3xl">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
