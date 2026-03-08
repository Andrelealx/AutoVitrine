import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Plan } from "../../lib/types";

export function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    priceCents: 0,
    vehicleLimit: "",
    userLimit: "",
    stripePriceId: ""
  });

  async function loadPlans() {
    const response = await api.get("/admin/plans");
    setPlans(response.data);
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await api.post("/admin/plans", {
      name: form.name,
      description: form.description,
      priceCents: Number(form.priceCents),
      vehicleLimit: form.vehicleLimit ? Number(form.vehicleLimit) : null,
      userLimit: form.userLimit ? Number(form.userLimit) : null,
      stripePriceId: form.stripePriceId || null
    });

    setForm({
      name: "",
      description: "",
      priceCents: 0,
      vehicleLimit: "",
      userLimit: "",
      stripePriceId: ""
    });

    loadPlans();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Planos</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie limites e preco dos planos mensais.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
            <h2 className="font-display text-2xl text-gold-300">{plan.name}</h2>
            <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
            <p className="mt-3 text-2xl font-semibold text-zinc-100">{formatCurrency(plan.priceCents / 100)}</p>
            <p className="mt-3 text-xs text-zinc-500">
              Limite veiculos: {plan.vehicleLimit ?? "Ilimitado"} • Limite usuarios: {plan.userLimit ?? "Ilimitado"}
            </p>
          </article>
        ))}
      </section>

      <form className="rounded-2xl border border-white/10 bg-base-900 p-5" onSubmit={handleSubmit}>
        <h2 className="font-display text-2xl text-zinc-100">Criar/Atualizar plano</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nome (BASICO, PRO, ILIMITADO)"
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
            placeholder="Limite de veiculos (vazio = ilimitado)"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.userLimit}
            onChange={(event) => setForm((prev) => ({ ...prev, userLimit: event.target.value }))}
            placeholder="Limite de usuarios (vazio = ilimitado)"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
          <input
            value={form.stripePriceId}
            onChange={(event) => setForm((prev) => ({ ...prev, stripePriceId: event.target.value }))}
            placeholder="Stripe Price ID"
            className="md:col-span-2 rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
          />
        </div>

        <button
          type="submit"
          className="mt-4 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
        >
          Salvar plano
        </button>
      </form>
    </div>
  );
}