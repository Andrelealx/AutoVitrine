import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type AdminStore = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  suspensionNote: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  subscriptions: Array<{
    status: string;
    gateway: string | null;
    plan: {
      name: string;
    };
  }>;
  _count: {
    vehicles: number;
    leads: number;
    users: number;
  };
};

export function AdminStoresPage() {
  const [items, setItems] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const { impersonate } = useAuth();
  const navigate = useNavigate();

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
      isActive: !store.isActive,
      note: store.isActive ? "Suspensa manualmente para analise" : "Reativada manualmente"
    });

    setActionMessage(store.isActive ? "Loja suspensa." : "Loja reativada.");
    loadStores();
  }

  async function startImpersonation(store: AdminStore) {
    const { data } = await api.post(`/admin/impersonate/stores/${store.id}`);
    impersonate({
      accessToken: data.accessToken,
      impersonatedUser: data.impersonatedUser
    });
    navigate("/dashboard");
  }

  async function cancelSubscription(store: AdminStore) {
    if (!window.confirm("Cancelar assinatura desta loja e suspender agora?")) {
      return;
    }

    await api.post(`/admin/stores/${store.id}/cancel-subscription`);
    setActionMessage("Assinatura cancelada e loja suspensa.");
    loadStores();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Lojas cadastradas</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie status, assinatura e suporte por impersonacao.</p>
      </header>

      {actionMessage ? <p className="text-sm text-green-300">{actionMessage}</p> : null}

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
                    {store.owner.name} - {store.owner.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Plano</p>
                  <p className="text-sm text-zinc-200">{store.subscriptions[0]?.plan.name || "Sem assinatura"}</p>
                  <p className="text-xs text-zinc-500">Gateway: {store.subscriptions[0]?.gateway || "-"}</p>
                  <p className="text-xs text-zinc-500">Status assinatura: {store.subscriptions[0]?.status || "-"}</p>
                  <p className="text-xs text-zinc-500">Status loja: {store.isActive ? "Ativa" : "Suspensa"}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-zinc-400">
                Veiculos: {store._count.vehicles} - Leads: {store._count.leads} - Usuarios: {store._count.users}
              </p>

              {!store.isActive && store.suspensionReason ? (
                <p className="mt-2 text-xs text-amber-200">
                  Motivo da suspensao: {store.suspensionReason}
                  {store.suspensionNote ? ` - ${store.suspensionNote}` : ""}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(store)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5"
                >
                  {store.isActive ? "Suspender loja" : "Reativar loja"}
                </button>

                <button
                  type="button"
                  onClick={() => startImpersonation(store)}
                  className="rounded-xl border border-gold-300/40 px-4 py-2 text-sm text-gold-200 hover:bg-gold-300/10"
                >
                  Entrar como lojista
                </button>

                <button
                  type="button"
                  onClick={() => cancelSubscription(store)}
                  className="rounded-xl border border-red-300/40 px-4 py-2 text-sm text-red-200 hover:bg-red-300/10"
                >
                  Cancelar assinatura
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}