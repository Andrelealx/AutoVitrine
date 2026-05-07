import { FormEvent, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../../lib/api";

interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone?: string;
  email?: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  cMun: string;
  xMun: string;
  uf: string;
}

const emptyForm = {
  nome: "", cpfCnpj: "", telefone: "", email: "",
  logradouro: "", numero: "", bairro: "",
  cep: "", cMun: "", xMun: "", uf: ""
};

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function formatDoc(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [buscaInput, setBuscaInput] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 20;

  useEffect(() => { load(); }, [page, q]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/clientes", { params: { q, page, pageSize } });
      setClientes(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } finally {
      setLoading(false);
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(buscaInput.trim());
  }

  function abrirNovo() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setErro(null);
    setShowForm(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditingId(c.id);
    setForm({
      nome: c.nome, cpfCnpj: c.cpfCnpj, telefone: c.telefone ?? "",
      email: c.email ?? "", logradouro: c.logradouro, numero: c.numero,
      bairro: c.bairro, cep: c.cep, cMun: c.cMun, xMun: c.xMun, uf: c.uf
    });
    setErro(null);
    setShowForm(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      if (editingId) {
        await api.put(`/clientes/${editingId}`, form);
      } else {
        await api.post("/clientes", form);
      }
      setShowForm(false);
      setPage(1);
      load();
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function deletar() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/clientes/${confirmDelete.id}`);
      setConfirmDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  function f(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-500">{total} cliente(s) cadastrado(s)</p>
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          className="flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-black hover:bg-gold-300"
        >
          <Plus size={15} />
          Novo Cliente
        </button>
      </div>

      {/* Busca */}
      <form onSubmit={buscar} className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={buscaInput}
            onChange={e => setBuscaInput(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
            className="w-full rounded-xl border border-white/10 bg-base-900 px-3 py-2 pr-9 text-sm text-zinc-100 placeholder-zinc-600 focus:border-gold-400/50 focus:outline-none"
          />
          <button type="submit" className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300">
            <Search size={14} />
          </button>
        </div>
        {q && (
          <button type="button" onClick={() => { setQ(""); setBuscaInput(""); setPage(1); }}
            className="rounded-xl border border-white/10 px-3 text-zinc-400 hover:text-zinc-200">
            <X size={14} />
          </button>
        )}
      </form>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gold-400" size={22} /></div>
      ) : clientes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-base-900 py-16 text-center">
          <p className="text-sm text-zinc-500">{q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-base-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">CPF / CNPJ</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Cidade / UF</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clientes.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-zinc-100">{c.nome}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDoc(c.cpfCnpj)}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.telefone || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.xMun && c.uf ? `${c.xMun}/${c.uf}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => abrirEdicao(c)}
                          className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-zinc-200">
                          <Pencil size={13} />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete({ id: c.id, nome: c.nome })}
                          className="rounded-lg border border-red-400/20 p-1.5 text-red-400 hover:bg-red-400/10">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm disabled:opacity-40">Anterior</button>
          <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm disabled:opacity-40">Próxima</button>
        </div>
      )}

      {/* Modal formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-base-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">
                {editingId ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={salvar} className="space-y-4">
              {erro && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs text-zinc-400">Nome / Razão Social *</label>
                  <input value={form.nome} onChange={f("nome")} required maxLength={60}
                    className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-400">CPF / CNPJ *</label>
                  <input value={form.cpfCnpj} onChange={f("cpfCnpj")} required maxLength={18} placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-400">Telefone</label>
                  <input value={form.telefone} onChange={f("telefone")} maxLength={20} placeholder="(21) 99999-9999"
                    className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs text-zinc-400">E-mail</label>
                  <input value={form.email} onChange={f("email")} type="email" maxLength={60}
                    className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Endereço</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs text-zinc-400">Logradouro</label>
                    <input value={form.logradouro} onChange={f("logradouro")} maxLength={60}
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">Número</label>
                    <input value={form.numero} onChange={f("numero")} maxLength={60}
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">Bairro</label>
                    <input value={form.bairro} onChange={f("bairro")} maxLength={60}
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">CEP</label>
                    <input value={form.cep} onChange={f("cep")} maxLength={9} placeholder="00000-000"
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">Cód. IBGE Município</label>
                    <input value={form.cMun} onChange={f("cMun")} maxLength={7} placeholder="3304557"
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">Município</label>
                    <input value={form.xMun} onChange={f("xMun")} maxLength={60}
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">UF</label>
                    <select value={form.uf} onChange={f("uf")}
                      className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none">
                      <option value="">Selecione</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-2 text-sm font-semibold text-black hover:bg-gold-300 disabled:opacity-50">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editingId ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-base-900 p-6">
            <h3 className="mb-2 text-base font-semibold text-zinc-100">Remover cliente?</h3>
            <p className="mb-5 text-sm text-zinc-400">{confirmDelete.nome}</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400">Cancelar</button>
              <button type="button" onClick={deletar} disabled={deleting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
