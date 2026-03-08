import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthBackground, AuthCard } from "../../components/layout/AuthLayout";
import { useAuth } from "../../context/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register({
        name,
        storeName,
        email,
        password
      });
      navigate("/dashboard/loja");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground>
      <AuthCard
        title="Criar Loja"
        subtitle="Comece sua vitrine digital white-label"
        footer={
          <>
            Ja possui conta?{" "}
            <Link to="/login" className="text-gold-300 hover:text-gold-200">
              Fazer login
            </Link>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">Seu nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-300">Nome da loja</label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />
          </div>

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
              minLength={8}
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
            {loading ? "Criando conta..." : "Comecar agora"}
          </button>
        </form>
      </AuthCard>
    </AuthBackground>
  );
}
