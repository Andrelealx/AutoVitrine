import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type AdminStats = {
  totalStores: number;
  activeStores: number;
  totalVehicles: number;
  totalLeads: number;
  activeSubscriptions: number;
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
    { label: "Assinaturas ativas", value: stats.activeSubscriptions }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Painel do Super Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">Visao geral da operacao SaaS AutoVitrine.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-white/10 bg-base-900 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-100">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}