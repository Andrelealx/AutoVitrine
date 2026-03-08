import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Plan, Subscription } from "../../lib/types";

export function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [plansRes, subRes] = await Promise.all([api.get("/subscriptions/plans"), api.get("/subscriptions/me")]);
    setPlans(plansRes.data);
    setSubscription(subRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  async function startCheckout(planId: string) {
    setMessage(null);
    try {
      const { data } = await api.post("/subscriptions/checkout-session", { planId });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Nao foi possivel iniciar checkout");
    }
  }

  async function openPortal() {
    setMessage(null);
    try {
      const { data } = await api.post("/subscriptions/portal");
      window.location.href = data.url;
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Nao foi possivel abrir portal");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Assinatura e planos</h1>
        <p className="mt-2 text-sm text-zinc-400">Faça upgrade, downgrade ou gerencie cobranca via Stripe.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Plano atual</h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-400">Carregando...</p>
        ) : subscription ? (
          <div className="mt-4 space-y-1 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Plano:</span> {subscription.plan.name}
            </p>
            <p>
              <span className="text-zinc-500">Status:</span> {subscription.status}
            </p>
            {subscription.currentPeriodEnd ? (
              <p>
                <span className="text-zinc-500">Renovacao:</span>{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={openPortal}
              className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5"
            >
              Gerenciar no Stripe
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">Nenhuma assinatura ativa.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <h3 className="font-display text-2xl text-gold-300">{plan.name}</h3>
            <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
            <p className="mt-4 text-3xl font-semibold text-zinc-100">{formatCurrency(plan.priceCents / 100)}</p>
            <p className="text-xs text-zinc-500">mensal</p>
            <ul className="mt-4 space-y-1 text-sm text-zinc-300">
              <li>Veiculos: {plan.vehicleLimit ?? "Ilimitado"}</li>
              <li>Usuarios: {plan.userLimit ?? "Ilimitado"}</li>
            </ul>
            <button
              type="button"
              onClick={() => startCheckout(plan.id)}
              className="mt-5 w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
            >
              Escolher plano
            </button>
          </article>
        ))}
      </section>

      {message ? <p className="text-sm text-red-400">{message}</p> : null}
    </div>
  );
}