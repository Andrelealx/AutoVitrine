import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  actorEmail: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/admin/audit-logs", {
        params: {
          page: 1,
          pageSize: 100
        }
      })
      .then((response) => setItems(response.data.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Auditoria</h1>
        <p className="mt-2 text-sm text-zinc-400">Historico completo das acoes do super admin.</p>
      </header>

      {loading ? (
        <p className="text-zinc-400">Carregando logs...</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-base-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-100">
                  {item.action} - {item.entityType}
                </p>
                <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{item.description || "Sem descricao adicional."}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Ator: {item.actorEmail || "sistema"} • Entidade: {item.entityId || "-"}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
