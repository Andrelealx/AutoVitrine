import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthBackground, AuthCard } from "../../components/layout/AuthLayout";
import { api } from "../../lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await api.post("/auth/reset-password", { token, password });
      setStatus("success");
      setMessage("Senha redefinida com sucesso. Voce ja pode fazer login.");
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.response?.data?.message || "Nao foi possivel redefinir a senha.");
    }
  }

  return (
    <AuthBackground>
      <AuthCard title="Nova senha" subtitle="Digite sua nova senha para concluir a recuperacao.">
        {token ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
              placeholder="Nova senha"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
            >
              Redefinir senha
            </button>
          </form>
        ) : (
          <p className="text-sm text-red-400">Token de redefinicao ausente ou invalido.</p>
        )}

        {status !== "idle" ? (
          <p className={`mt-4 text-sm ${status === "success" ? "text-green-300" : "text-red-400"}`}>
            {message}
          </p>
        ) : null}
      </AuthCard>
    </AuthBackground>
  );
}