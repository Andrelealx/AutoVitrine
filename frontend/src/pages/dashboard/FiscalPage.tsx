import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Search,
  Settings,
  Upload,
  X,
  XCircle
} from "lucide-react";
import { api } from "../../lib/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "config" | "emitir" | "historico";

interface LojaFiscal {
  id: string;
  cnpj: string;
  ie: string;
  crt: number;
  ambiente: number;
  serie: number;
  ultimaNNF: number;
  temCertificado: boolean;
  logradouro: string;
  numero: string;
  bairro: string;
  cMun: string;
  xMun: string;
  uf: string;
  cep: string;
  fone: string;
  cUF: number;
}

interface NotaFiscal {
  id: string;
  chaveAcesso: string;
  nNF: number;
  serie: number;
  dhEmi: string;
  nomeDestinatario: string;
  cpfCnpjDestinatario: string;
  valorTotal: number;
  protocolo?: string;
  status: "pendente" | "autorizada" | "cancelada" | "erro";
  motivoErro?: string;
  createdAt: string;
  veiculo?: { id: string; brand: string; model: string; plate?: string };
}

interface VeiculoBusca {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate?: string;
  renavam?: string;
  chassis?: string;
  price: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NotaFiscal["status"] }) {
  const map: Record<NotaFiscal["status"], { label: string; cls: string }> = {
    autorizada: { label: "Autorizada", cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
    cancelada:  { label: "Cancelada",  cls: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" },
    pendente:   { label: "Pendente",   cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
    erro:       { label: "Erro",       cls: "bg-red-500/15 text-red-300 border border-red-500/30" }
  };
  const { label, cls } = map[status] ?? map.erro;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDoc(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

// ─── Aba Configuração ─────────────────────────────────────────────────────────

function AbaConfig() {
  const [fiscal, setFiscal] = useState<LojaFiscal | null>(null);
  const [configurado, setConfigurado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [testando, setTestando] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [certStatus, setCertStatus] = useState<"idle" | "ok" | "error">("idle");
  const [statusSefaz, setStatusSefaz] = useState<{ cStat: string; xMotivo: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    cnpj: "", ie: "", crt: "1", ambiente: "2", serie: "1",
    logradouro: "", numero: "", bairro: "", cMun: "", xMun: "",
    uf: "", cep: "", fone: "", cUF: "33"
  });
  const [certSenha, setCertSenha] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [editandoNum, setEditandoNum] = useState(false);
  const [proximaNNF, setProximaNNF] = useState("");
  const [salvandoNum, setSalvandoNum] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await api.get("/nfe/config");
      setConfigurado(res.data.configurado);
      if (res.data.fiscal) {
        const f: LojaFiscal = res.data.fiscal;
        setFiscal(f);
        setForm({
          cnpj: f.cnpj, ie: f.ie, crt: String(f.crt), ambiente: String(f.ambiente),
          serie: String(f.serie), logradouro: f.logradouro, numero: f.numero,
          bairro: f.bairro, cMun: f.cMun, xMun: f.xMun, uf: f.uf,
          cep: f.cep, fone: f.fone, cUF: String(f.cUF)
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function salvarConfig(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post("/nfe/config", form);
      setMsg({ type: "success", text: "Configuração salva com sucesso!" });
      loadConfig();
    } catch (err: any) {
      setMsg({ type: "error", text: err?.response?.data?.message ?? "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  }

  async function enviarCertificado() {
    if (!certFile || !certSenha) return;
    setUploadingCert(true);
    setCertStatus("idle");
    try {
      const fd = new FormData();
      fd.append("certificado", certFile);
      fd.append("senha", certSenha);
      await api.post("/nfe/config/certificado", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setCertStatus("ok");
      setCertFile(null);
      setCertSenha("");
    } catch {
      setCertStatus("error");
    } finally {
      setUploadingCert(false);
    }
  }

  async function salvarNumeracao() {
    const num = parseInt(proximaNNF);
    if (isNaN(num) || num < 1) return;
    setSalvandoNum(true);
    setMsg(null);
    try {
      const res = await api.put("/nfe/config/numeracao", { proximaNNF: num });
      setMsg({ type: "success", text: res.data.message });
      setEditandoNum(false);
      loadConfig();
    } catch (err: any) {
      setMsg({ type: "error", text: err?.response?.data?.message ?? "Erro ao atualizar numeração" });
    } finally {
      setSalvandoNum(false);
    }
  }

  async function testarSefaz() {
    setTestando(true);
    setStatusSefaz(null);
    try {
      const res = await api.get("/nfe/config/status");
      setStatusSefaz(res.data.status);
    } catch (err: any) {
      setStatusSefaz({ cStat: "999", xMotivo: err?.response?.data?.message ?? "Erro de conexão" });
    } finally {
      setTestando(false);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCertFile(file);
  }

  function setField(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gold-400" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dados fiscais */}
      <form onSubmit={salvarConfig} className="rounded-2xl border border-white/10 bg-base-900 p-6">
        <h3 className="mb-5 text-base font-semibold text-zinc-100">Dados Fiscais da Loja</h3>

        {msg && (
          <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm ${
            msg.type === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}>
            {msg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CNPJ" value={form.cnpj} onChange={v => setField("cnpj", v)} placeholder="00.000.000/0001-00" required />
          <Field label="Inscrição Estadual" value={form.ie} onChange={v => setField("ie", v)} placeholder="123456789" required />
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Regime Tributário (CRT)</label>
            <select
              value={form.crt}
              onChange={e => setField("crt", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none"
            >
              <option value="1">1 — Simples Nacional</option>
              <option value="2">2 — Simples Nacional — Excesso</option>
              <option value="3">3 — Regime Normal</option>
            </select>
          </div>
          <Field label="Logradouro" value={form.logradouro} onChange={v => setField("logradouro", v)} placeholder="Rua dos Veículos" required />
          <Field label="Número" value={form.numero} onChange={v => setField("numero", v)} placeholder="123" required />
          <Field label="Bairro" value={form.bairro} onChange={v => setField("bairro", v)} placeholder="Centro" required />
          <Field label="Cód. Município (IBGE 7 dígitos)" value={form.cMun} onChange={v => setField("cMun", v)} placeholder="3304557" required maxLength={7} />
          <Field label="Município" value={form.xMun} onChange={v => setField("xMun", v)} placeholder="Rio de Janeiro" required />
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">UF *</label>
            <select
              value={form.uf}
              onChange={e => setField("uf", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none"
              required
            >
              <option value="">Selecione</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <Field label="CEP" value={form.cep} onChange={v => setField("cep", v)} placeholder="20000-000" required />
          <Field label="Telefone" value={form.fone} onChange={v => setField("fone", v)} placeholder="21999999999" required />
          <Field label="Cód. UF (IBGE)" value={form.cUF} onChange={v => setField("cUF", v)} placeholder="33" type="number" required />
        </div>

        {/* Ambiente */}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs text-zinc-400">Ambiente de Emissão</label>
          <div className="flex gap-4">
            {[{ v: "2", l: "Homologação (testes)" }, { v: "1", l: "Produção" }].map(opt => (
              <label key={opt.v} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="ambiente"
                  value={opt.v}
                  checked={form.ambiente === opt.v}
                  onChange={() => setField("ambiente", opt.v)}
                  className="accent-gold-400"
                />
                {opt.l}
                {opt.v === "1" && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">PRODUÇÃO</span>}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-300 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          Salvar Configuração
        </button>
      </form>

      {/* Numeração das NF-e */}
      {fiscal && (
        <div className="rounded-2xl border border-white/10 bg-base-900 p-6">
          <h3 className="mb-1 text-base font-semibold text-zinc-100">Numeração das NF-e</h3>
          <p className="mb-5 text-xs text-zinc-500">
            CNPJ: {fiscal.cnpj} — Série {fiscal.serie}
          </p>

          {msg && (
            <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm ${
              msg.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-red-500/30 bg-red-500/10 text-red-300"
            }`}>
              {msg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {msg.text}
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="w-48">
              <label className="mb-1.5 block text-xs text-zinc-400">Número da PRÓXIMA NOTA FISCAL</label>
              {editandoNum ? (
                <input
                  type="number"
                  min={fiscal.ultimaNNF + 1}
                  value={proximaNNF}
                  onChange={e => setProximaNNF(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-gold-400/50 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
                />
              ) : (
                <div className="rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm font-mono text-zinc-100">
                  {fiscal.ultimaNNF + 1}
                </div>
              )}
            </div>
            <div className="w-28">
              <label className="mb-1.5 block text-xs text-zinc-400">Nº de Série</label>
              <div className="rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm font-mono text-zinc-100">
                {fiscal.serie}
              </div>
            </div>
            {editandoNum ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={salvarNumeracao}
                  disabled={salvandoNum || !proximaNNF}
                  className="flex items-center gap-1.5 rounded-xl bg-gold-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-gold-300 disabled:opacity-50"
                >
                  {salvandoNum ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => { setEditandoNum(false); setProximaNNF(""); }}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditandoNum(true); setProximaNNF(String(fiscal.ultimaNNF + 1)); }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:border-white/20 hover:text-zinc-100"
              >
                Editar
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Última NF-e emitida: {fiscal.ultimaNNF === 0 ? "nenhuma" : `nº ${fiscal.ultimaNNF}`}
          </p>
        </div>
      )}

      {/* Certificado Digital */}
      <div className="rounded-2xl border border-white/10 bg-base-900 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Certificado Digital A1 (.pfx)</h3>
          {fiscal?.temCertificado ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              <CheckCircle size={11} /> Certificado configurado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <AlertTriangle size={11} /> Sem certificado
            </span>
          )}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="mb-4 cursor-pointer rounded-xl border-2 border-dashed border-white/15 p-6 text-center transition hover:border-gold-400/40 hover:bg-white/5"
        >
          <Upload size={24} className="mx-auto mb-2 text-zinc-500" />
          <p className="text-sm text-zinc-400">
            {certFile ? (
              <span className="text-gold-300">{certFile.name}</span>
            ) : (
              <>Clique ou arraste o arquivo <strong>.pfx</strong> aqui</>
            )}
          </p>
          <input ref={fileRef} type="file" accept=".pfx" className="hidden" onChange={handleFile} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <Field
              label="Senha do Certificado"
              value={certSenha}
              onChange={setCertSenha}
              type="password"
              placeholder="Senha do arquivo .pfx"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={enviarCertificado}
              disabled={!certFile || !certSenha || uploadingCert}
              className="flex items-center gap-2 rounded-xl bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-40"
            >
              {uploadingCert ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Enviar
            </button>
          </div>
        </div>

        {certStatus === "ok" && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-300">
            <CheckCircle size={13} /> Certificado enviado com sucesso
          </p>
        )}
        {certStatus === "error" && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-300">
            <XCircle size={13} /> Erro ao enviar certificado — verifique a senha
          </p>
        )}
      </div>

      {/* Testar SEFAZ */}
      <div className="rounded-2xl border border-white/10 bg-base-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Conexão com SEFAZ</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Ambiente: {form.ambiente === "1" ? "Produção" : "Homologação"} — SVRS (RJ)
            </p>
          </div>
          <button
            type="button"
            onClick={testarSefaz}
            disabled={testando}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20 hover:text-zinc-100 disabled:opacity-50"
          >
            {testando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Testar Conexão
          </button>
        </div>

        {statusSefaz && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${
            statusSefaz.cStat === "107"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}>
            {statusSefaz.cStat === "107" ? <CheckCircle size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            <span>
              <strong>cStat {statusSefaz.cStat}</strong> — {statusSefaz.xMotivo}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba Emitir NF-e ─────────────────────────────────────────────────────────

function AbaEmitir({ onEmitida }: { onEmitida: () => void }) {
  const [busca, setBusca] = useState("");
  const [veiculos, setVeiculos] = useState<VeiculoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<VeiculoBusca | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensagem: string;
    nota?: { id: string; nNF: number; protocolo?: string };
  } | null>(null);

  const [form, setForm] = useState({
    placa: "", descricao: "", renavam: "", chassi: "", valorVenda: "",
    cpfCnpjDestinatario: "", nomeDestinatario: "",
    logradouroDestinatario: "", numeroDestinatario: "", bairroDestinatario: "",
    cMunDestinatario: "", xMunDestinatario: "", ufDestinatario: "",
    cepDestinatario: "", emailDestinatario: "", tipoPagamento: "99"
  });

  useEffect(() => {
    if (busca.length < 2) { setVeiculos([]); return; }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/nfe/veiculos/busca?q=${encodeURIComponent(busca)}`);
        setVeiculos(res.data.items);
        setShowDropdown(true);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  function selecionarVeiculo(v: VeiculoBusca) {
    setVeiculoSelecionado(v);
    setBusca(`${v.brand} ${v.model} ${v.year} — ${v.plate ?? "sem placa"}`);
    setShowDropdown(false);
    setForm(f => ({
      ...f,
      placa: v.plate ?? f.placa,
      renavam: v.renavam ?? f.renavam,
      chassi: v.chassis ?? f.chassi,
      valorVenda: v.price ? String(parseFloat(v.price)) : f.valorVenda,
      descricao: f.descricao || `${v.brand} ${v.model} ${v.year} - COR: ${v.color}${v.plate ? ` - PLACA: ${v.plate}` : ""}`
    }));
  }

  function setField(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function emitir(e: FormEvent) {
    e.preventDefault();
    setEmitindo(true);
    setResultado(null);
    try {
      const payload = {
        ...form,
        veiculoId: veiculoSelecionado?.id,
        valorVenda: parseFloat(form.valorVenda.replace(",", "."))
      };
      const res = await api.post("/nfe/emitir", payload);
      setResultado({ ok: true, mensagem: res.data.message, nota: res.data.nota });
      onEmitida();
    } catch (err: any) {
      const d = err?.response?.data;
      const msg = d?.xMotivo ? `cStat ${d.cStat}: ${d.xMotivo}` : (d?.message ?? "Erro ao emitir NF-e");
      setResultado({ ok: false, mensagem: msg });
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <form onSubmit={emitir} className="space-y-5">
      {resultado && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 ${
          resultado.ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          {resultado.ok ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-medium">{resultado.mensagem}</p>
            {resultado.nota && (
              <p className="mt-1 text-sm opacity-80">
                NF-e Nº {String(resultado.nota.nNF).padStart(9, "0")} — Protocolo: {resultado.nota.protocolo}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Veículo */}
      <div className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">Veículo</h3>

        <div className="relative mb-4">
          <label className="mb-1.5 block text-xs text-zinc-400">Buscar veículo do estoque</label>
          <div className="relative">
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setVeiculoSelecionado(null); }}
              onFocus={() => veiculos.length > 0 && setShowDropdown(true)}
              placeholder="Pesquise por placa, marca ou modelo..."
              className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 pr-8 text-sm text-zinc-100 placeholder-zinc-600 focus:border-gold-400/50 focus:outline-none"
            />
            <span className="absolute right-2.5 top-2.5 text-zinc-500">
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </span>
          </div>

          {showDropdown && veiculos.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-base-900 shadow-xl">
              {veiculos.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selecionarVeiculo(v)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-white/5"
                >
                  <div>
                    <p className="text-zinc-100">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-zinc-500">{v.plate ? `Placa: ${v.plate}` : "Sem placa"} — {v.color}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gold-400">
                    {parseFloat(v.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Placa *" value={form.placa} onChange={v => setField("placa", v)} placeholder="EWU0E37" required />
          <Field label="RENAVAM" value={form.renavam} onChange={v => setField("renavam", v)} placeholder="00123456789" />
          <Field label="Chassi (VIN)" value={form.chassi} onChange={v => setField("chassi", v)} placeholder="9BW..." maxLength={17} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Field
              label="Descrição do Produto *"
              value={form.descricao}
              onChange={v => setField("descricao", v)}
              placeholder="GM - Chevrolet Zafira 2.0 2012/2012 - COR: BRANCA - PLACA: EWU0E37"
              required
            />
          </div>
          <Field
            label="Valor de Venda (R$) *"
            value={form.valorVenda}
            onChange={v => setField("valorVenda", v)}
            placeholder="30000.00"
            type="number"
            required
          />
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">Forma de Pagamento</label>
            <select
              value={form.tipoPagamento}
              onChange={e => setField("tipoPagamento", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none"
            >
              <option value="99">99 — Outros</option>
              <option value="01">01 — Dinheiro</option>
              <option value="02">02 — Cheque</option>
              <option value="03">03 — Cartão de Crédito</option>
              <option value="04">04 — Cartão de Débito</option>
              <option value="05">05 — Crédito Loja</option>
              <option value="10">10 — Vale Alimentação</option>
              <option value="13">13 — Boleto Bancário</option>
              <option value="15">15 — Boleto Bancário</option>
              <option value="90">90 — Sem Pagamento</option>
            </select>
          </div>
        </div>
      </div>

      {/* Destinatário */}
      <div className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">Dados do Comprador (Destinatário)</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CPF / CNPJ *" value={form.cpfCnpjDestinatario} onChange={v => setField("cpfCnpjDestinatario", v)} placeholder="000.000.000-00" required />
          <div className="sm:col-span-2">
            <Field label="Nome / Razão Social *" value={form.nomeDestinatario} onChange={v => setField("nomeDestinatario", v)} placeholder="João da Silva" required />
          </div>
          <div className="sm:col-span-2">
            <Field label="Logradouro *" value={form.logradouroDestinatario} onChange={v => setField("logradouroDestinatario", v)} placeholder="Rua das Flores" required />
          </div>
          <Field label="Número *" value={form.numeroDestinatario} onChange={v => setField("numeroDestinatario", v)} placeholder="100" required />
          <Field label="Bairro *" value={form.bairroDestinatario} onChange={v => setField("bairroDestinatario", v)} placeholder="Centro" required />
          <Field label="Cód. Município (IBGE 7 dígitos) *" value={form.cMunDestinatario} onChange={v => setField("cMunDestinatario", v)} placeholder="3304557" required maxLength={7} />
          <Field label="Município *" value={form.xMunDestinatario} onChange={v => setField("xMunDestinatario", v)} placeholder="Rio de Janeiro" required />
          <div>
            <label className="mb-1.5 block text-xs text-zinc-400">UF *</label>
            <select
              value={form.ufDestinatario}
              onChange={e => setField("ufDestinatario", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 focus:border-gold-400/50 focus:outline-none"
              required
            >
              <option value="">Selecione</option>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <Field label="CEP *" value={form.cepDestinatario} onChange={v => setField("cepDestinatario", v)} placeholder="20000-000" required />
          <Field label="E-mail" value={form.emailDestinatario} onChange={v => setField("emailDestinatario", v)} placeholder="comprador@email.com" type="email" />
        </div>
      </div>

      <button
        type="submit"
        disabled={emitindo}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-black hover:bg-gold-300 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {emitindo ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Enviando para SEFAZ...
          </>
        ) : (
          <>
            <FileText size={15} />
            Emitir NF-e
          </>
        )}
      </button>
    </form>
  );
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────

function AbaHistorico({ refresh }: { refresh: number }) {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const pageSize = 20;

  useEffect(() => {
    load();
  }, [page, statusFiltro, refresh]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/nfe/notas", {
        params: { page, pageSize, ...(statusFiltro ? { status: statusFiltro } : {}) }
      });
      setNotas(res.data.items);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }

  async function baixarArquivo(id: string, tipo: "xml" | "danfe") {
    try {
      const res = await api.get(`/nfe/notas/${id}/${tipo}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = tipo === "xml" ? `NFe_${id}.xml` : `DANFE_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao baixar arquivo");
    }
  }

  async function cancelar(id: string) {
    if (justificativa.length < 15) {
      alert("Justificativa deve ter ao menos 15 caracteres");
      return;
    }
    try {
      const res = await api.post(`/nfe/notas/${id}/cancelar`, { justificativa });
      setMsg({ id, text: res.data.message, ok: true });
      setCancelando(null);
      setJustificativa("");
      load();
    } catch (err: any) {
      setMsg({ id, text: err?.response?.data?.message ?? "Erro ao cancelar", ok: false });
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3">
        <select
          value={statusFiltro}
          onChange={e => { setStatusFiltro(e.target.value); setPage(1); }}
          className="rounded-xl border border-white/10 bg-base-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="autorizada">Autorizadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="erro">Com erro</option>
          <option value="pendente">Pendentes</option>
        </select>
        <span className="text-xs text-zinc-500">{total} nota(s)</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-gold-400" size={20} />
        </div>
      ) : notas.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-base-900 py-16 text-center">
          <FileText size={32} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">Nenhuma nota fiscal emitida ainda</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-base-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Nº NF-e</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Destinatário</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {notas.map(nota => (
                  <>
                    <tr key={nota.id} className="group hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {String(nota.nNF).padStart(9, "0")}
                        {nota.protocolo && (
                          <span className="ml-2 text-[10px] text-zinc-500">{nota.protocolo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{formatData(nota.dhEmi)}</td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-200">{nota.nomeDestinatario}</p>
                        <p className="text-xs text-zinc-500">{formatDoc(nota.cpfCnpjDestinatario)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-200">
                        {formatMoeda(nota.valorTotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={nota.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {nota.status === "autorizada" && (
                            <>
                              <button
                                type="button"
                                onClick={() => baixarArquivo(nota.id, "xml")}
                                title="Baixar XML"
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => baixarArquivo(nota.id, "danfe")}
                                title="Baixar DANFE"
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelando(cancelando === nota.id ? null : nota.id)}
                                title="Cancelar NF-e"
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-red-300"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Painel de cancelamento */}
                    {cancelando === nota.id && (
                      <tr key={`cancel-${nota.id}`}>
                        <td colSpan={6} className="bg-red-500/5 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              value={justificativa}
                              onChange={e => setJustificativa(e.target.value)}
                              placeholder="Justificativa do cancelamento (mín. 15 caracteres)"
                              className="flex-1 rounded-xl border border-red-500/30 bg-base-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => cancelar(nota.id)}
                              className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
                            >
                              Confirmar Cancelamento
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelando(null)}
                              className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100"
                            >
                              Desistir
                            </button>
                          </div>
                          {msg?.id === nota.id && (
                            <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
                              {msg.text}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* Motivo do erro */}
                    {nota.status === "erro" && nota.motivoErro && (
                      <tr key={`erro-${nota.id}`}>
                        <td colSpan={6} className="bg-red-500/5 px-4 py-2">
                          <p className="text-xs text-red-300">
                            <strong>Erro:</strong> {nota.motivoErro}
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:border-white/20 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-zinc-500">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:border-white/20 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente Field reutilizável ────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}

function Field({ label, value, onChange, placeholder, required, type = "text", maxLength }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-zinc-400">
        {label} {required && <span className="text-gold-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-xl border border-white/10 bg-base-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-gold-400/50 focus:outline-none"
      />
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export function FiscalPage() {
  const [tab, setTab] = useState<Tab>("config");
  const [historicoRefresh, setHistoricoRefresh] = useState(0);

  const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: "config",    label: "Configuração", icon: Settings },
    { id: "emitir",   label: "Emitir NF-e",  icon: FileText },
    { id: "historico", label: "Histórico",    icon: Download }
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Notas Fiscais Eletrônicas</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Emissão de NF-e modelo 55 direto na SEFAZ — sem intermediários
        </p>
      </div>

      {/* Aviso de homologação */}
      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          <strong>Ambiente de Homologação ativo por padrão.</strong> Notas emitidas em homologação têm
          validade apenas para testes — não geram obrigação fiscal. Mude para Produção apenas quando
          tudo estiver validado.
        </p>
      </div>

      {/* Abas */}
      <div className="flex border-b border-white/10">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.id
                  ? "border-gold-400 text-gold-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      {tab === "config" && <AbaConfig />}
      {tab === "emitir" && (
        <AbaEmitir onEmitida={() => setHistoricoRefresh(r => r + 1)} />
      )}
      {tab === "historico" && <AbaHistorico refresh={historicoRefresh} />}
    </div>
  );
}
