import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthBackground, AuthCard } from "../../components/layout/AuthLayout";
import { useAuth } from "../../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const nextUser = await login({ email, password });
      const target = location.state?.from?.pathname || (nextUser.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
      navigate(target);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard
        title="Login"
        subtitle="Acesse seu painel da AutoVitrine"
        footer={
          <>
            Nao possui conta?{" "}
            <Link to="/register" className="text-gold-300 hover:text-gold-200">
              Crie sua loja
            </Link>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <Link to="/forgot-password" className="block text-center text-sm text-zinc-400 hover:text-gold-300">
            Esqueci minha senha
          </Link>
        </form>
      </AuthCard>
    </AuthBackground>
  );
}
