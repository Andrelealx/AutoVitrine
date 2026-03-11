import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Plan } from "../../lib/types";

type PlanForm = {
  name: string;
  description: string;
  priceCents: string;
  vehicleLimit: string;
  userLimit: string;
  maxPhotosPerVehicle: string;
  allowCustomDomain: boolean;
  removeWatermark: boolean;
  includeReports: boolean;
  includeAdvancedReports: boolean;
  allowOutboundWebhooks: boolean;
  trialDays: string;
  isTrial: boolean;
  showTrialBanner: boolean;
  isActive: boolean;
  sortOrder: string;
  stripePriceId: string;
  mercadopagoPlanId: string;
};

const emptyForm: PlanForm = {
  name: "",
  description: "",
  priceCents: "",
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
  sortOrder: "",
  stripePriceId: "",
  mercadopagoPlanId: ""
};

function parseOptionalInt(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return NaN;
  }

  return parsed;
}

export function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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
    setFormError(null);
    setFormSuccess(null);
    setForm({
      name: plan.name,
      description: plan.description,
      priceCents: String(plan.priceCents),
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
      sortOrder: String(plan.sortOrder),
      stripePriceId: plan.stripePriceId || "",
      mercadopagoPlanId: plan.mercadopagoPlanId || ""
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const priceCents = Number(form.priceCents);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      setFormError("Preco invalido. Use centavos, por exemplo: 7990 para R$ 79,90.");
      return;
    }

    const vehicleLimit = parseOptionalInt(form.vehicleLimit);
    const userLimit = parseOptionalInt(form.userLimit);
    const maxPhotosPerVehicle = parseOptionalInt(form.maxPhotosPerVehicle);
    const trialDays = parseOptionalInt(form.trialDays);
    const sortOrder = form.sortOrder.trim() === "" ? 0 : Number(form.sortOrder);

    if (
      [vehicleLimit, userLimit, maxPhotosPerVehicle, trialDays].some((item) => Number.isNaN(item)) ||
      !Number.isInteger(sortOrder)
    ) {
      setFormError("Limites e ordem precisam ser numeros inteiros. Deixe em branco quando for ilimitado.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      priceCents,
      vehicleLimit,
      userLimit,
      maxPhotosPerVehicle,
      allowCustomDomain: form.allowCustomDomain,
      removeWatermark: form.removeWatermark,
      includeReports: form.includeReports,
      includeAdvancedReports: form.includeAdvancedReports,
      allowOutboundWebhooks: form.allowOutboundWebhooks,
      trialDays,
      isTrial: form.isTrial,
      showTrialBanner: form.showTrialBanner,
      isActive: form.isActive,
      sortOrder,
      stripePriceId: form.stripePriceId.trim() || null,
      mercadopagoPlanId: form.mercadopagoPlanId.trim() || null
    };

    if (!payload.name || !payload.description) {
      setFormError("Nome e descricao sao obrigatorios.");
      return;
    }

    setSubmitting(true);

    try {
      if (editingPlanId) {
        await api.patch(`/admin/plans/${editingPlanId}`, payload);
        setFormSuccess("Plano atualizado com sucesso.");
      } else {
        await api.post("/admin/plans", payload);
        setFormSuccess("Plano criado com sucesso.");
      }

      setEditingPlanId(null);
      setForm({ ...emptyForm });
      await loadPlans();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || "Nao foi possivel salvar o plano.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Planos</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie precos, limites e recursos de cada plano.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-4 text-sm text-zinc-300">
        <p className="font-semibold text-zinc-200">Como preencher</p>
        <p className="mt-1 text-zinc-400">Preco e informado em centavos (ex.: 7990 = R$ 79,90).</p>
        <p className="text-zinc-400">Campos de limite podem ficar vazios para indicar "Ilimitado".</p>
        <p className="text-zinc-400">Ordem controla a posicao no painel (menor numero aparece primeiro).</p>
      </section>

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
              <p>Ordem: {plan.sortOrder}</p>
            </div>
          </article>
        ))}
      </section>

      <form className="rounded-2xl border border-white/10 bg-base-900 p-5" onSubmit={handleSubmit}>
        <h2 className="font-display text-2xl text-zinc-100">
          {isEditing ? "Editar plano" : "Criar/Atualizar plano"}
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Nome do plano *</p>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ex.: BASICO, PROFISSIONAL, ENTERPRISE"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Preco mensal em centavos *</p>
            <input
              required
              type="number"
              min={0}
              value={form.priceCents}
              onChange={(event) => setForm((prev) => ({ ...prev, priceCents: event.target.value }))}
              placeholder="Ex.: 7990"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="md:col-span-2 space-y-1">
            <p className="text-xs text-zinc-400">Descricao *</p>
            <input
              required
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Resumo do plano para uso interno e exibicao"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Limite de veiculos</p>
            <input
              value={form.vehicleLimit}
              onChange={(event) => setForm((prev) => ({ ...prev, vehicleLimit: event.target.value }))}
              placeholder="Vazio = ilimitado"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Limite de usuarios</p>
            <input
              value={form.userLimit}
              onChange={(event) => setForm((prev) => ({ ...prev, userLimit: event.target.value }))}
              placeholder="Vazio = ilimitado"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Fotos por veiculo</p>
            <input
              value={form.maxPhotosPerVehicle}
              onChange={(event) => setForm((prev) => ({ ...prev, maxPhotosPerVehicle: event.target.value }))}
              placeholder="Vazio = ilimitado"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Dias de trial</p>
            <input
              value={form.trialDays}
              onChange={(event) => setForm((prev) => ({ ...prev, trialDays: event.target.value }))}
              placeholder="Ex.: 14"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Stripe Price ID (opcional)</p>
            <input
              value={form.stripePriceId}
              onChange={(event) => setForm((prev) => ({ ...prev, stripePriceId: event.target.value }))}
              placeholder="price_..."
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-1">
            <p className="text-xs text-zinc-400">Mercado Pago Plan ID (opcional)</p>
            <input
              value={form.mercadopagoPlanId}
              onChange={(event) => setForm((prev) => ({ ...prev, mercadopagoPlanId: event.target.value }))}
              placeholder="ID do plano no MP"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>

          <div className="md:col-span-2 grid gap-2 rounded-xl border border-white/10 bg-base-950 p-3 text-sm text-zinc-200 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowCustomDomain}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowCustomDomain: event.target.checked }))}
                />
                Dominio customizado
              </span>
              <span className="block text-xs text-zinc-500">Permite que a loja use dominio proprio.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.removeWatermark}
                  onChange={(event) => setForm((prev) => ({ ...prev, removeWatermark: event.target.checked }))}
                />
                Remove marca d'agua
              </span>
              <span className="block text-xs text-zinc-500">Remove "Powered by" na vitrine publica.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.includeReports}
                  onChange={(event) => setForm((prev) => ({ ...prev, includeReports: event.target.checked }))}
                />
                Relatorios de acesso/leads
              </span>
              <span className="block text-xs text-zinc-500">Libera relatorios basicos no painel da loja.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.includeAdvancedReports}
                  onChange={(event) => setForm((prev) => ({ ...prev, includeAdvancedReports: event.target.checked }))}
                />
                Relatorios avancados
              </span>
              <span className="block text-xs text-zinc-500">Libera relatórios detalhados e comparativos.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowOutboundWebhooks}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, allowOutboundWebhooks: event.target.checked }))
                  }
                />
                Webhooks de saida
              </span>
              <span className="block text-xs text-zinc-500">Permite enviar eventos para integracoes externas.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isTrial}
                  onChange={(event) => setForm((prev) => ({ ...prev, isTrial: event.target.checked }))}
                />
                Plano trial
              </span>
              <span className="block text-xs text-zinc-500">Nao exige cobranca inicial, com duracao limitada.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showTrialBanner}
                  onChange={(event) => setForm((prev) => ({ ...prev, showTrialBanner: event.target.checked }))}
                />
                Banner de trial na vitrine
              </span>
              <span className="block text-xs text-zinc-500">Mostra aviso publico de periodo de teste.</span>
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Plano ativo
              </span>
              <span className="block text-xs text-zinc-500">Plano disponivel para novas assinaturas.</span>
            </label>
          </div>

          <label className="md:col-span-2 space-y-1">
            <p className="text-xs text-zinc-400">Ordem de exibicao</p>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
              placeholder="Vazio = 0"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </label>
        </div>

        {formError ? <p className="mt-4 text-sm text-red-400">{formError}</p> : null}
        {formSuccess ? <p className="mt-4 text-sm text-green-300">{formSuccess}</p> : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
          >
            {submitting ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Salvar plano"}
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setEditingPlanId(null);
                setFormError(null);
                setFormSuccess(null);
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