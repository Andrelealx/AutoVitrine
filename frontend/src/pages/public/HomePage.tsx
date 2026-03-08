import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="min-h-screen bg-base-950 text-zinc-100">
      <div className="absolute inset-0 bg-grid [background-size:24px_24px] opacity-20" />
      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-3xl text-gold-300">AutoVitrine</h1>
          <div className="flex gap-3">
            <Link to="/login" className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/5">
              Entrar
            </Link>
            <Link to="/register" className="rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-base-950 hover:bg-gold-300">
              Criar loja
            </Link>
          </div>
        </header>

        <section className="mt-20 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold-300">SaaS White-Label para lojistas</p>
            <h2 className="mt-4 font-display text-5xl leading-tight">
              Venda mais com uma vitrine digital luxuosa e personalizada.
            </h2>
            <p className="mt-6 text-zinc-300">
              O AutoVitrine oferece painel completo para estoque, leads e assinatura, com URL propria para cada loja.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="rounded-xl bg-gold-400 px-5 py-3 text-sm font-semibold text-base-950 hover:bg-gold-300">
                Comecar teste
              </Link>
              <Link to="/login" className="rounded-xl border border-white/20 px-5 py-3 text-sm hover:bg-white/5">
                Ja sou cliente
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-gold-400/30 bg-gradient-to-b from-gold-400/10 to-transparent p-6 shadow-luxe">
            <img
              src="https://images.unsplash.com/photo-1549924231-f129b911e442?q=80&w=1400&auto=format&fit=crop"
              alt="Luxury automotive"
              className="h-[420px] w-full rounded-2xl object-cover"
            />
          </div>
        </section>
      </div>
    </div>
  );
}