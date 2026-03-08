import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base-950 px-4 text-center text-zinc-200">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">404</p>
      <h1 className="mt-3 font-display text-5xl text-gold-300">Pagina nao encontrada</h1>
      <p className="mt-4 text-sm text-zinc-400">O endereco informado nao existe ou foi movido.</p>
      <Link to="/" className="mt-6 rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-base-950 hover:bg-gold-300">
        Ir para inicio
      </Link>
    </div>
  );
}