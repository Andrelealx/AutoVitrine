import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Lead } from "../../lib/types";

export function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/stores/me/leads", {
        params: {
          page: 1,
          pageSize: 50
        }
      })
      .then((response) => setItems(response.data.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Leads e contatos</h1>
        <p className="mt-2 text-sm text-zinc-400">Todos os interessados enviados pela vitrine publica.</p>
      </header>

      {loading ? (
        <p className="text-zinc-400">Carregando leads...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-base-900 p-6 text-sm text-zinc-400">
          Nenhum lead recebido ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((lead) => (
            <article key={lead.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-100">{lead.name}</h3>
                <span className="text-xs text-zinc-500">{new Date(lead.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">Telefone: {lead.phone}</p>
              {lead.email ? <p className="text-sm text-zinc-300">E-mail: {lead.email}</p> : null}
              <p className="mt-3 text-sm text-zinc-400">{lead.message}</p>
              {lead.vehicle ? (
                <p className="mt-3 text-xs text-gold-300">
                  Veiculo de interesse: {lead.vehicle.brand} {lead.vehicle.model} ({lead.vehicle.year})
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}