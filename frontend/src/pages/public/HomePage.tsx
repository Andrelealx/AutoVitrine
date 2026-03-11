import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "../../components/branding/BrandLogo";

const valueCards = [
  {
    title: "Marca premium para sua loja",
    description: "Vitrine customizada com identidade propria e experiencia de alto padrao.",
    icon: Sparkles
  },
  {
    title: "Leads qualificados em tempo real",
    description: "Receba contatos, acompanhe interesse por veiculo e acelere fechamento.",
    icon: BarChart3
  },
  {
    title: "Operacao protegida e escalavel",
    description: "Permissoes por perfil, auditoria e estrutura pronta para crescimento.",
    icon: ShieldCheck
  },
  {
    title: "Performance comercial no painel",
    description: "Visao clara de estoque, equipe e conversao para decidir com seguranca.",
    icon: Gauge
  }
];

const highlights = ["Vitrine white-label", "Planos flexiveis", "Checkout Stripe e Mercado Pago", "Suporte para equipe"];

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-base-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(212,168,69,0.28),transparent_34%),radial-gradient(circle_at_90%_14%,rgba(32,70,150,0.28),transparent_34%),linear-gradient(180deg,#06070B_0%,#090C16_48%,#07080B_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid [background-size:22px_22px] opacity-20" />
      <div className="drift-slow pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="drift-slower pointer-events-none absolute -right-20 top-28 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-8 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandLogo tone="gold" subtitle="SaaS para concessionarias" />
          <div className="flex gap-3">
            <Link
              to="/login"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/5"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
            >
              Criar minha vitrine
            </Link>
          </div>
        </header>

        <main className="mt-12 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="reveal-up space-y-7">
            <p className="inline-flex items-center rounded-full border border-gold-300/35 bg-gold-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-gold-200">
              Identidade, vendas e escalabilidade
            </p>

            <h1 className="font-display text-5xl leading-[1.02] text-zinc-50 sm:text-6xl">
              Sua loja merece uma vitrine que convence antes do primeiro contato.
            </h1>

            <p className="max-w-2xl text-base text-zinc-300 sm:text-lg">
              O VitrineAuto transforma concessionarias em marcas digitais fortes, com pagina propria, gestao comercial
              inteligente e assinatura pronta para escalar.
            </p>

            <div className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
              {highlights.map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-gold-300" />
                  {item}
                </p>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
              >
                Quero minha loja no VitrineAuto
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm text-zinc-100 transition hover:bg-white/5"
              >
                Ja sou cliente
              </Link>
            </div>
          </section>

          <aside className="reveal-up [animation-delay:180ms] space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-gold-300/25 bg-gradient-to-br from-[#101A31] via-[#0C1427] to-[#090F1C] p-6 shadow-luxe">
              <div className="pulse-gold pointer-events-none absolute -right-10 -top-8 h-36 w-36 rounded-full bg-gold-400/20 blur-2xl" />
              <BrandLogo tone="light" subtitle="Painel comercial da loja" />

              <div className="mt-6 grid grid-cols-2 gap-3">
                <article className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Leads no mes</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-100">128</p>
                  <p className="text-xs text-emerald-300">+34% vs mes anterior</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Veiculos ativos</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-100">76</p>
                  <p className="text-xs text-zinc-300">Atualizacao em tempo real</p>
                </article>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Pipeline de atendimento</p>
                <div className="mt-3 space-y-2 text-sm text-zinc-200">
                  <p className="flex items-center justify-between">
                    Novos contatos <span className="font-semibold text-gold-300">43</span>
                  </p>
                  <p className="flex items-center justify-between">
                    Em negociacao <span className="font-semibold text-gold-300">19</span>
                  </p>
                  <p className="flex items-center justify-between">
                    Fechados <span className="font-semibold text-gold-300">11</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-200">
              "Com o VitrineAuto, nossa loja ganhou autoridade digital e aumentou os contatos qualificados ja no
              primeiro mes."
            </div>
          </aside>
        </main>

        <section className="reveal-up [animation-delay:240ms] mt-14">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-base-900/70 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-gold-300/30"
                >
                  <div className="inline-flex rounded-xl border border-gold-300/30 bg-gold-400/10 p-2 text-gold-300">
                    <Icon size={20} />
                  </div>
                  <h2 className="mt-4 font-display text-2xl text-zinc-100">{card.title}</h2>
                  <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="reveal-up [animation-delay:320ms] mt-12 rounded-3xl border border-gold-300/25 bg-gradient-to-r from-gold-400/20 via-gold-400/10 to-transparent p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold-200">Pronto para posicionar sua marca?</p>
              <h3 className="mt-2 font-display text-4xl text-zinc-100">
                Entre agora e transforme sua loja em referencia digital.
              </h3>
            </div>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
            >
              Comecar agora
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
