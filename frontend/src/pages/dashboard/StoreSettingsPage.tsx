import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Store } from "../../lib/types";

const defaultStore: Store = {
  id: "",
  name: "Minha Loja",
  slug: "minha-loja",
  primaryColor: "#C9A44C",
  secondaryColor: "#111111",
  theme: "LUXURY",
  isActive: true,
  onboardingCompleted: false
};

export function StoreSettingsPage() {
  const [store, setStore] = useState<Store>(defaultStore);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/stores/me")
      .then((response) => setStore(response.data))
      .catch(() => setError("Nao foi possivel carregar os dados da loja."))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof Store>(key: K, value: Store[K]) {
    setStore((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await api.post("/stores/me/upload/logo", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      updateField("logoUrl", response.data.imageUrl);
      setMessage("Logo enviado com sucesso.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha no upload da logo.");
    }
  }

  async function handleBannerUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await api.post("/stores/me/upload/banner", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      updateField("bannerUrl", response.data.imageUrl);
      setMessage("Banner enviado com sucesso.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha no upload do banner.");
    }
  }

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await api.put("/stores/me/onboarding", {
        name: store.name,
        city: store.city,
        state: store.state,
        whatsapp: store.whatsapp,
        instagram: store.instagram,
        description: store.description,
        logoUrl: store.logoUrl,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor
      });

      setStore(response.data.store);
      setMessage("Onboarding salvo. Sua URL da loja foi atualizada.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Nao foi possivel salvar onboarding.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomization() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await api.put("/stores/me/customization", {
        theme: store.theme,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor,
        bannerUrl: store.bannerUrl,
        slogan: store.slogan,
        aboutUs: store.aboutUs,
        facebook: store.facebook,
        instagram: store.instagram,
        whatsapp: store.whatsapp,
        openingHours: store.openingHours,
        address: store.address,
        mapEmbedUrl: store.mapEmbedUrl
      });

      setStore(response.data.store);
      setMessage("Personalizacao atualizada com sucesso.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Nao foi possivel salvar personalizacao.");
    } finally {
      setSaving(false);
    }
  }

  const previewStyles = useMemo(
    () => ({
      backgroundColor: store.secondaryColor || "#111111",
      color: store.primaryColor || "#C9A44C"
    }),
    [store.secondaryColor, store.primaryColor]
  );

  if (loading) {
    return <p className="text-zinc-400">Carregando configuracoes...</p>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-4xl text-gold-300">Configuracao da loja</h1>
          <p className="mt-2 text-sm text-zinc-400">Onboarding, branding e conteudo da sua vitrine white-label.</p>
        </header>

        <form onSubmit={saveOnboarding} className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <h2 className="font-display text-2xl text-zinc-100">Onboarding</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              required
              value={store.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Nome da loja"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              required
              value={store.city || ""}
              onChange={(event) => updateField("city", event.target.value)}
              placeholder="Cidade"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              required
              value={store.state || ""}
              onChange={(event) => updateField("state", event.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              required
              value={store.whatsapp || ""}
              onChange={(event) => updateField("whatsapp", event.target.value)}
              placeholder="WhatsApp"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              value={store.instagram || ""}
              onChange={(event) => updateField("instagram", event.target.value)}
              placeholder="Instagram (usuario ou URL)"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="rounded-xl border border-white/15 bg-base-950 p-3 text-xs text-zinc-400">
                Cor primaria
                <input
                  type="color"
                  value={store.primaryColor}
                  onChange={(event) => updateField("primaryColor", event.target.value)}
                  className="mt-2 h-10 w-full"
                />
              </label>
              <label className="rounded-xl border border-white/15 bg-base-950 p-3 text-xs text-zinc-400">
                Cor secundaria
                <input
                  type="color"
                  value={store.secondaryColor}
                  onChange={(event) => updateField("secondaryColor", event.target.value)}
                  className="mt-2 h-10 w-full"
                />
              </label>
            </div>
            <textarea
              value={store.description || ""}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Descricao curta"
              className="md:col-span-2 min-h-[100px] rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <label className="rounded-xl border border-dashed border-white/20 bg-base-950/50 p-3 text-sm text-zinc-300">
              Upload de logo
              <input type="file" accept="image/*" className="mt-2 block" onChange={handleLogoUpload} />
            </label>
            <label className="rounded-xl border border-dashed border-white/20 bg-base-950/50 p-3 text-sm text-zinc-300">
              Upload de banner
              <input type="file" accept="image/*" className="mt-2 block" onChange={handleBannerUpload} />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar onboarding"}
          </button>
        </form>

        <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <h2 className="font-display text-2xl text-zinc-100">Conteudo e tema</h2>
          <div className="mt-4 grid gap-3">
            <select
              value={store.theme}
              onChange={(event) => updateField("theme", event.target.value as Store["theme"])}
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            >
              <option value="LIGHT">Claro</option>
              <option value="DARK">Escuro</option>
              <option value="LUXURY">Luxo (dark gold)</option>
            </select>

            <input
              value={store.slogan || ""}
              onChange={(event) => updateField("slogan", event.target.value)}
              placeholder="Slogan"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />

            <textarea
              value={store.aboutUs || ""}
              onChange={(event) => updateField("aboutUs", event.target.value)}
              placeholder="Sobre nos"
              className="min-h-[120px] rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />

            <input
              value={store.facebook || ""}
              onChange={(event) => updateField("facebook", event.target.value)}
              placeholder="Facebook URL"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              value={store.openingHours || ""}
              onChange={(event) => updateField("openingHours", event.target.value)}
              placeholder="Horario de funcionamento"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              value={store.address || ""}
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Endereco"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
            <input
              value={store.mapEmbedUrl || ""}
              onChange={(event) => updateField("mapEmbedUrl", event.target.value)}
              placeholder="Google Maps Embed URL"
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={saveCustomization}
            disabled={saving}
            className="mt-4 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar personalizacao"}
          </button>
        </section>

        {message ? <p className="text-sm text-green-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4 text-sm text-zinc-300">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">URL publica</p>
          <p className="mt-2 break-all text-gold-300">
            {window.location.origin.replace(/:\d+$/, "")} /loja/{store.slug}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10" style={previewStyles}>
          <div
            className="h-40 bg-cover bg-center"
            style={{ backgroundImage: store.bannerUrl ? `url(${store.bannerUrl})` : undefined }}
          />
          <div className="p-4">
            <div className="flex items-center gap-3">
              <img
                src={store.logoUrl || "https://placehold.co/80x80?text=Logo"}
                alt="logo"
                className="h-14 w-14 rounded-full border border-white/30 object-cover"
              />
              <div>
                <p className="font-display text-2xl">{store.name}</p>
                <p className="text-xs opacity-80">{store.slogan || "Sua vitrine premium de veiculos"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm opacity-90">{store.description || "Descricao da loja"}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}