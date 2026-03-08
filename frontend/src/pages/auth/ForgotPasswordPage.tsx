import { FormEvent, useState } from "react";
import { AuthBackground, AuthCard } from "../../components/layout/AuthLayout";
import { api } from "../../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard title="Recuperar Senha" subtitle="Enviaremos um link de redefinicao para seu e-mail.">
        {sent ? (
          <p className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            Se o e-mail existir, as instrucoes foram enviadas.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
              placeholder="seu-email@loja.com"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthBackground>
  );
}