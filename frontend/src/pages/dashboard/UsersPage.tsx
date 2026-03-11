import { FormEvent, useEffect, useState } from "react";
import { UpgradeModal } from "../../components/billing/UpgradeModal";
import { api } from "../../lib/api";
import { PlanUsage } from "../../lib/types";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type SubscriptionResponse = {
  planUsage: PlanUsage;
};

export function UsersPage() {
  const [items, setItems] = useState<TeamUser[]>([]);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);

    const [usersRes, subRes] = await Promise.all([
      api.get("/stores/me/users"),
      api.get<SubscriptionResponse>("/subscriptions/me")
    ]);

    setItems(usersRes.data);
    setPlanUsage(subRes.data.planUsage);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleApiError(err: any, fallbackMessage: string) {
    const statusCode = err?.response?.status;
    const details = err?.response?.data?.details;

    if (statusCode === 402 && details?.code === "PLAN_LIMIT_REACHED") {
      setUpgradeModalMessage(err?.response?.data?.message || fallbackMessage);
      setError(null);
      return;
    }

    if (statusCode === 423 && details?.code === "STORE_SUSPENDED") {
      setError("A loja esta suspensa. Operacoes de escrita estao bloqueadas.");
      return;
    }

    setError(err?.response?.data?.message || fallbackMessage);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.post("/stores/me/users", form);
      setMessage("Usuario da equipe criado com sucesso.");
      setForm({ name: "", email: "", password: "" });
      loadUsers();
    } catch (err: any) {
      handleApiError(err, "Falha ao criar usuario.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Equipe</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie usuarios da loja de acordo com seu plano.</p>
      </header>

      {planUsage ? (
        <section className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <p className="text-sm text-zinc-300">
            Uso atual de usuarios: {planUsage.usage.users.used}/{planUsage.usage.users.limit ?? "Ilimitado"}
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Novo colaborador</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="Nome"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="E-mail"
          />
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="Senha provisoria"
          />
          <button
            type="submit"
            className="md:col-span-3 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 hover:bg-gold-300"
          >
            Criar usuario
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-300">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Usuarios cadastrados</h2>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-400">Carregando...</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-base-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
                  <span className="text-xs text-zinc-500">{item.role}</span>
                </div>
                <p className="text-sm text-zinc-300">{item.email}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <UpgradeModal
        open={Boolean(upgradeModalMessage)}
        message={upgradeModalMessage || ""}
        onClose={() => setUpgradeModalMessage(null)}
      />
    </div>
  );
}