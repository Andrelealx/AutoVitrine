import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type AdminStore = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  owner: {
    name: string;
    email: string;
  };
  subscriptions: Array<{
    status: string;
    plan: {
      name: string;
    };
  }>;
  _count: {
    vehicles: number;
    leads: number;
  };
};

export function AdminStoresPage() {
  const [items, setItems] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadStores() {
    setLoading(true);
    const response = await api.get("/admin/stores", {
      params: { page: 1, pageSize: 100 }
    });
    setItems(response.data.items);
    setLoading(false);
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function toggleStatus(store: AdminStore) {
    await api.patch(`/admin/stores/${store.id}/status`, {
      isActive: !store.isActive
    });
    loadStores();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Lojas cadastradas</h1>
        <p className="mt-2 text-sm text-zinc-400">Ative ou bloqueie lojas e acompanhe volume de uso.</p>
      </header>

      {loading ? (
        <p className="text-zinc-400">Carregando lojas...</p>
      ) : (
        <div className="space-y-3">
          {items.map((store) => (
            <article key={store.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">{store.name}</h2>
                  <p className="text-sm text-zinc-400">/{store.slug}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {store.owner.name} • {store.owner.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Plano</p>
                  <p className="text-sm text-zinc-200">{store.subscriptions[0]?.plan.name || "Sem assinatura"}</p>
                  <p className="text-xs text-zinc-500">Status: {store.isActive ? "Ativa" : "Bloqueada"}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-zinc-400">
                Veiculos: {store._count.vehicles} • Leads: {store._count.leads}
              </p>

              <button
                type="button"
                onClick={() => toggleStatus(store)}
                className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5"
              >
                {store.isActive ? "Bloquear loja" : "Ativar loja"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}