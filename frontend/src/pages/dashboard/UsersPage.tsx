import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export function UsersPage() {
  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function loadUsers() {
    setLoading(true);
    api
      .get("/stores/me/users")
      .then((response) => setItems(response.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await api.post("/stores/me/users", form);
      setMessage("Usuario da equipe criado com sucesso.");
      setForm({ name: "", email: "", password: "" });
      loadUsers();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha ao criar usuario.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Equipe</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie usuarios da loja de acordo com seu plano.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Novo colaborador</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="Nome"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="E-mail"
          />
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            placeholder="Senha provisoria"
          />
          <button
            type="submit"
            className="md:col-span-3 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 hover:bg-gold-300"
          >
            Criar usuario
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-green-300">{message}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">Usuarios cadastrados</h2>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-400">Carregando...</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-base-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
                  <span className="text-xs text-zinc-500">{item.role}</span>
                </div>
                <p className="text-sm text-zinc-300">{item.email}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}