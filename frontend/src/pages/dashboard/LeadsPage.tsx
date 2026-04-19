import { useEffect, useRef, useState } from "react";
import {
  Car,
  Check,
  Copy,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Users,
  X
} from "lucide-react";
import { api } from "../../lib/api";
import { Lead } from "../../lib/types";

const PAGE_SIZE = 20;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
      title="Copiar"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  const rawPhone = lead.phone.replace(/\D/g, "");
  const whatsappHref = `https://wa.me/55${rawPhone}`;
  const mailHref = lead.email ? `mailto:${lead.email}` : null;

  return (
    <article className="rounded-2xl border border-white/10 bg-base-900 p-5 transition hover:border-white/20">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-zinc-300">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-zinc-100">{lead.name}</p>
            <p className="text-xs text-zinc-500">
              {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          </div>
        </div>

        {lead.vehicle && (
          <span className="flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/10 px-3 py-1 text-[11px] text-gold-300">
            <Car size={11} />
            {lead.vehicle.brand} {lead.vehicle.model} {lead.vehicle.year}
          </span>
        )}
      </div>

      {/* Mensagem */}
      <p className="mt-4 text-sm leading-relaxed text-zinc-300">{lead.message}</p>

      {/* Contatos + ações */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Phone size={13} className="text-zinc-500" />
            <span className="text-sm text-zinc-300">{lead.phone}</span>
            <CopyButton text={lead.phone} />
          </div>
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <Mail size={13} className="text-zinc-500" />
              <span className="text-sm text-zinc-300">{lead.email}</span>
              <CopyButton text={lead.email} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mailHref && (
            <a
              href={mailHref}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/30 hover:text-zinc-100"
            >
              <Mail size={12} />
              E-mail
            </a>
          )}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <MessageSquare size={12} />
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}

export function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get("/stores/me/leads", {
        params: { page, pageSize: PAGE_SIZE, search: query || undefined }
      })
      .then((response) => {
        setItems(response.data.items);
        setTotal(response.data.total ?? response.data.items.length);
      })
      .finally(() => setLoading(false));
  }, [page, query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  }

  function clearSearch() {
    setSearch("");
    setQuery("");
    setPage(1);
    searchRef.current?.focus();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold-300">Leads e contatos</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {total > 0
              ? `${total} contato${total !== 1 ? "s" : ""} recebido${total !== 1 ? "s" : ""} pela vitrine`
              : "Interessados enviados pela vitrine publica"}
          </p>
        </div>
      </header>

      {/* Busca */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem..."
            className="w-full rounded-xl border border-white/10 bg-base-900 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold-400/50 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-xl bg-gold-400 px-4 py-2.5 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
        >
          Buscar
        </button>
      </form>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-base-900 py-16 text-center">
          {query ? (
            <>
              <Search size={36} className="text-zinc-700" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">Nenhum resultado para "{query}"</p>
                <p className="mt-1 text-xs text-zinc-500">Tente outro termo ou limpe a busca.</p>
              </div>
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Limpar busca
              </button>
            </>
          ) : (
            <>
              <Users size={36} className="text-zinc-700" />
              <div>
                <p className="text-sm font-semibold text-zinc-300">Nenhum lead ainda</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Compartilhe o link da sua vitrine para receber contatos.
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
