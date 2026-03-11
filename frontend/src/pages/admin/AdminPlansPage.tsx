import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Plan } from "../../lib/types";

const emptyForm = {
  name: "",
  description: "",
  priceCents: 0,
  vehicleLimit: "",
  userLimit: "",
  maxPhotosPerVehicle: "",
  allowCustomDomain: false,
  removeWatermark: false,
  includeReports: false,
  includeAdvancedReports: false,
  allowOutboundWebhooks: false,
  trialDays: "",
  isTrial: false,
  showTrialBanner: false,
  isActive: true,
  sortOrder: 0,
  stripePriceId: "",
  mercadopagoPlanId: ""
};

export function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const isEditing = useMemo(() => Boolean(editingPlanId), [editingPlanId]);

  async function loadPlans() {
    const response = await api.get("/admin/plans");
    setPlans(response.data);
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function hydrateForm(plan: Plan) {
    setEditingPlanId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      vehicleLimit: plan.vehicleLimit === null ? "" : String(plan.vehicleLimit),
      userLimit: plan.userLimit === null ? "" : String(plan.userLimit),
      maxPhotosPerVehicle: plan.maxPhotosPerVehicle === null ? "" : String(plan.maxPhotosPerVehicle),
      allowCustomDomain: plan.allowCustomDomain,
      removeWatermark: plan.removeWatermark,
      includeReports: plan.includeReports,
      includeAdvancedReports: plan.includeAdvancedReports,
      allowOutboundWebhooks: plan.allowOutboundWebhooks,
      trialDays: plan.trialDays === null ? "" : String(plan.trialDays),
      isTrial: plan.isTrial,
      showTrialBanner: plan.showTrialBanner,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      stripePriceId: plan.stripePriceId || "",
      mercadopagoPlanId: plan.mercadopagoPlanId || ""
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name,
      description: form.description,
      priceCents: Number(form.priceCents),
      vehicleLimit: form.vehicleLimit ? Number(form.vehicleLimit) : null,
      userLimit: form.userLimit ? Number(form.userLimit) : null,
      maxPhotosPerVehicle: form.maxPhotosPerVehicle ? Number(form.maxPhotosPerVehicle) : null,
      allowCustomDomain: form.allowCustomDomain,
      removeWatermark: form.removeWatermark,
      includeReports: form.includeReports,
      includeAdvancedReports: form.includeAdvancedReports,
      allowOutboundWebhooks: form.allowOutboundWebhooks,
      trialDays: form.trialDays ? Number(form.trialDays) : null,
      isTrial: form.isTrial,
      showTrialBanner: form.showTrialBanner,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
      stripePriceId: form.stripePriceId || null,
      mercadopagoPlanId: form.mercadopagoPlanId || null
    };

    if (editingPlanId) {
      await api.patch(`/admin/plans/${editingPlanId}`, payload);
    } else {
      await api.post("/admin/plans", payload);
    }

    setEditingPlanId(null);
    setForm({ ...emptyForm });

    loadPlans();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Planos</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie precos, limites e recursos de cada plano.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-gold-300">{plan.name}</h2>
                <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
              </div>
              <button
                type="button"
                onClick={() => hydrateForm(plan)}
                className="rounded-xl border border-white/20 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"
              >
                Editar
              </button>
            </div>

            <p className="mt-3 text-2xl font-semibold text-zinc-100">{formatCurrency(plan.priceCents / 100)}</p>
            <div className="mt-3 text-xs text-zinc-400">
              <p>Veiculos: {plan.vehicleLimit ?? "Ilimitado"}</p>
              <p>Usuarios: {plan.userLimit ?? "Ilimitado"}</p>
              <p>Fotos por veiculo: {plan.maxPhotosPerVehicle ?? "Ilimitado"}</p>
              <p>Dominio customizado: {plan.allowCustomDomain ? "Sim" : "Nao"}</p>
              <p>Remove marca d'agua: {plan.removeWatermark ? "Sim" : "Nao"}</p>
              <p>Relatorios: {plan.includeReports ? "Sim" : "Nao"}</p>
              <p>Relatorios avancados: {plan.includeAdvancedReports ? "Sim" : "Nao"}</p>
              <p>Webhooks de saida: {plan.allowOutboundWebhooks ? "Sim" : "Nao"}</p>
              <p>Trial: {plan.isTrial ? `Sim (${plan.trialDays || 14} dias)` : "Nao"}</p>
              <p>Status: {plan.isActive ? "Ativo" : "Inativo"}</p>
            </div>
          </article>
        ))}
      </section>

      <form className="rounded-2xl border border-white/10 bg-base-900 p-5" onSubmit={handleSubmit}>
        <h2 className="font-display text-2xl text-zinc-100">
          {isEditing ? "Editar plano" : "Criar/Atualizar plano"}
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nome"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            required
            type="number"
            value={form.priceCents}
            onChange={(event) => setForm((prev) => ({ ...prev, priceCents: Number(event.target.value) }))}
            placeholder="Preco em centavos"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            required
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descricao"
            className="md:col-span-2 rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.vehicleLimit}
            onChange={(event) => setForm((prev) => ({ ...prev, vehicleLimit: event.target.value }))}
            placeholder="Limite de veiculos"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.userLimit}
            onChange={(event) => setForm((prev) => ({ ...prev, userLimit: event.target.value }))}
            placeholder="Limite de usuarios"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.maxPhotosPerVehicle}
            onChange={(event) => setForm((prev) => ({ ...prev, maxPhotosPerVehicle: event.target.value }))}
            placeholder="Fotos por veiculo"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.trialDays}
            onChange={(event) => setForm((prev) => ({ ...prev, trialDays: event.target.value }))}
            placeholder="Dias de trial"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.stripePriceId}
            onChange={(event) => setForm((prev) => ({ ...prev, stripePriceId: event.target.value }))}
            placeholder="Stripe Price ID"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.mercadopagoPlanId}
            onChange={(event) => setForm((prev) => ({ ...prev, mercadopagoPlanId: event.target.value }))}
            placeholder="Mercado Pago Plan ID"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />

          <div className="md:col-span-2 grid gap-2 rounded-xl border border-white/10 bg-base-950 p-3 text-sm text-zinc-200 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowCustomDomain}
                onChange={(event) => setForm((prev) => ({ ...prev, allowCustomDomain: event.target.checked }))}
              />
              Dominio customizado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.removeWatermark}
                onChange={(event) => setForm((prev) => ({ ...prev, removeWatermark: event.target.checked }))}
              />
              Remove marca d'agua
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.includeReports}
                onChange={(event) => setForm((prev) => ({ ...prev, includeReports: event.target.checked }))}
              />
              Relatorios de acesso/leads
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.includeAdvancedReports}
                onChange={(event) => setForm((prev) => ({ ...prev, includeAdvancedReports: event.target.checked }))}
              />
              Relatorios avancados
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowOutboundWebhooks}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, allowOutboundWebhooks: event.target.checked }))
                }
              />
              Webhooks de saida
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isTrial}
                onChange={(event) => setForm((prev) => ({ ...prev, isTrial: event.target.checked }))}
              />
              Plano trial
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.showTrialBanner}
                onChange={(event) => setForm((prev) => ({ ...prev, showTrialBanner: event.target.checked }))}
              />
              Banner de trial na vitrine
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Plano ativo
            </label>
          </div>

          <input
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
            placeholder="Ordem"
            className="md:col-span-2 rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
          >
            {isEditing ? "Salvar alteracoes" : "Salvar plano"}
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setEditingPlanId(null);
                setForm({ ...emptyForm });
              }}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5"
            >
              Cancelar edicao
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}