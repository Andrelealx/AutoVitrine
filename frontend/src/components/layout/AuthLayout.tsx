import { Link } from "react-router-dom";
import { BrandLogo } from "../branding/BrandLogo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-base-900/80 p-8 shadow-luxe backdrop-blur">
      <h1 className="font-display text-4xl text-gold-300">{title}</h1>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 text-sm text-zinc-300">{footer}</div> : null}
    </div>
  );
}

export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base-950 px-4 py-10">
      <div className="absolute inset-0 bg-grid [background-size:28px_28px] opacity-25" />
      <div className="absolute -left-20 top-12 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="relative z-10 w-full">{children}</div>
      <Link to="/" className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-gold-300">
        <BrandLogo tone="gold" size="sm" showWordmark={false} />
        Voltar ao inicio
      </Link>
    </div>
  );
}
