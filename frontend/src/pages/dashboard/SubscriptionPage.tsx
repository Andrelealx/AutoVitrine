import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { BillingGateway, Plan, PlanUsage, Subscription } from "../../lib/types";

type SubscriptionResponse = {
  subscription: Subscription | null;
  planUsage: PlanUsage;
};

export function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<BillingGateway>("STRIPE");

  async function loadData() {
    setLoading(true);
    const [plansRes, subRes] = await Promise.all([
      api.get("/subscriptions/plans"),
      api.get<SubscriptionResponse>("/subscriptions/me")
    ]);
    setPlans(plansRes.data);
    setSubscription(subRes.data.subscription);
    setPlanUsage(subRes.data.planUsage);
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => setLoading(false));
  }, []);

  const trialDaysLeft = useMemo(() => {
    const endsAt = planUsage?.trial?.trialEndsAt;

    if (!planUsage?.trial?.isTrialing || !endsAt) {
      return null;
    }

    const diffMs = new Date(endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [planUsage]);

  async function startCheckout(plan: Plan) {
    setMessage(null);

    try {
      const { data } = await api.post("/subscriptions/checkout-session", {
        planId: plan.id,
        gateway: plan.isTrial ? "TRIAL" : selectedGateway
      });

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.mode === "TRIAL") {
        setMessage(`Trial ativado com sucesso ate ${new Date(data.trialEndsAt).toLocaleDateString("pt-BR")}.`);
        await loadData();
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

  async function cancelSubscription() {
    if (!window.confirm("Cancelar assinatura agora e suspender a loja?")) {
      return;
    }

    setMessage(null);

    try {
      await api.post("/subscriptions/cancel");
      setMessage("Assinatura cancelada. A loja foi suspensa e os dados ficam preservados por 30 dias.");
      await loadData();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "Nao foi possivel cancelar a assinatura");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Assinatura e planos</h1>
        <p className="mt-2 text-sm text-zinc-400">Escolha gateway, gerencie renovacao e acompanhe limites.</p>
      </header>

      {trialDaysLeft !== null ? (
        <section className="rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4">
          <p className="text-sm text-amber-100">
            Sua loja esta em trial. Faltam <strong>{trialDaysLeft}</strong> dias para expirar.
          </p>
        </section>
      ) : null}

      {planUsage ? (
        <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <h2 className="font-display text-2xl text-zinc-100">Uso do plano</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
              <p className="text-xs text-zinc-500">Veiculos</p>
              <p>
                {planUsage.usage.vehicles.used} / {planUsage.usage.vehicles.limit ?? "Ilimitado"}
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
              <p className="text-xs text-zinc-500">Usuarios</p>
              <p>
                {planUsage.usage.users.used} / {planUsage.usage.users.limit ?? "Ilimitado"}
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-base-950/50 p-3 text-sm text-zinc-300">
              <p className="text-xs text-zinc-500">Fotos por veiculo</p>
              <p>{planUsage.usage.photosPerVehicle.limit ?? "Ilimitado"}</p>
            </article>
          </div>
        </section>
      ) : null}

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
            <p>
              <span className="text-zinc-500">Gateway:</span> {subscription.gateway || "-"}
            </p>
            {subscription.currentPeriodEnd ? (
              <p>
                <span className="text-zinc-500">Renovacao:</span>{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {subscription.gateway === "STRIPE" ? (
                <button
                  type="button"
                  onClick={openPortal}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 hover:bg-white/5"
                >
                  Gerenciar no Stripe
                </button>
              ) : null}

              <button
                type="button"
                onClick={cancelSubscription}
                className="rounded-xl border border-red-300/40 px-4 py-2 text-sm text-red-200 hover:bg-red-300/10"
              >
                Cancelar assinatura
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">Nenhuma assinatura ativa.</p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Gateway de pagamento</h2>
        <p className="mt-2 text-sm text-zinc-400">Escolha como deseja pagar ao selecionar um plano pago.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedGateway("STRIPE")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              selectedGateway === "STRIPE"
                ? "border-gold-300 bg-gold-400/20 text-gold-200"
                : "border-white/20 text-zinc-200 hover:bg-white/5"
            }`}
          >
            Stripe (cartao)
          </button>
          <button
            type="button"
            onClick={() => setSelectedGateway("MERCADO_PAGO")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              selectedGateway === "MERCADO_PAGO"
                ? "border-gold-300 bg-gold-400/20 text-gold-200"
                : "border-white/20 text-zinc-200 hover:bg-white/5"
            }`}
          >
            Mercado Pago (PIX, boleto e cartao)
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <h3 className="font-display text-2xl text-gold-300">{plan.name}</h3>
            <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
            <p className="mt-4 text-3xl font-semibold text-zinc-100">{formatCurrency(plan.priceCents / 100)}</p>
            <p className="text-xs text-zinc-500">mensal</p>
            <ul className="mt-4 space-y-1 text-sm text-zinc-300">
              <li>Veiculos: {plan.vehicleLimit ?? "Ilimitado"}</li>
              <li>Usuarios: {plan.userLimit ?? "Ilimitado"}</li>
              <li>Fotos por veiculo: {plan.maxPhotosPerVehicle ?? "Ilimitado"}</li>
              <li>Dominio customizado: {plan.allowCustomDomain ? "Sim" : "Nao"}</li>
              <li>Marca d'agua removida: {plan.removeWatermark ? "Sim" : "Nao"}</li>
            </ul>
            <button
              type="button"
              onClick={() => startCheckout(plan)}
              className="mt-5 w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
            >
              {plan.isTrial ? "Ativar trial" : `Escolher com ${selectedGateway === "STRIPE" ? "Stripe" : "Mercado Pago"}`}
            </button>
          </article>
        ))}
      </section>

      {message ? <p className="text-sm text-zinc-200">{message}</p> : null}
    </div>
  );
}