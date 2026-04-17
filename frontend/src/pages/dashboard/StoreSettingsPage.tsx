import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageCircle,
  Palette,
  Share2,
  Sparkles,
  Wand2
} from "lucide-react";
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

type ThemePreset = {
  id: string;
  name: string;
  description: string;
  theme: Store["theme"];
  primaryColor: string;
  secondaryColor: string;
};

type OnboardingSnapshot = {
  name: string;
  city: string;
  state: string;
  whatsapp: string;
  instagram: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
};

type CustomizationSnapshot = {
  theme: Store["theme"];
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string;
  slogan: string;
  aboutUs: string;
  facebook: string;
  instagram: string;
  whatsapp: string;
  openingHours: string;
  address: string;
  mapEmbedUrl: string;
};

const themePresets: ThemePreset[] = [
  {
    id: "luxury-gold",
    name: "Luxo Gold",
    description: "Visual premium escuro para showroom de alto ticket.",
    theme: "LUXURY",
    primaryColor: "#C9A44C",
    secondaryColor: "#0D111A"
  },
  {
    id: "urban-night",
    name: "Urban Night",
    description: "Contraste forte para performance e esportivos.",
    theme: "DARK",
    primaryColor: "#00D1FF",
    secondaryColor: "#0A0D14"
  },
  {
    id: "classic-silver",
    name: "Classic Silver",
    description: "Estilo limpo e corporativo para frota premium.",
    theme: "LIGHT",
    primaryColor: "#334155",
    secondaryColor: "#F3F5F9"
  },
  {
    id: "bold-red",
    name: "Bold Red",
    description: "Mais energia para campanhas de giro rapido.",
    theme: "DARK",
    primaryColor: "#EF4444",
    secondaryColor: "#121212"
  }
];

const MAX_DESCRIPTION = 300;
const MAX_SLOGAN = 120;
const MAX_ABOUT = 2500;
const MAX_OPENING_HOURS = 300;
const MAX_ADDRESS = 300;
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024;

function buildOnboardingSnapshot(store: Store): OnboardingSnapshot {
  return {
    name: store.name || "",
    city: store.city || "",
    state: store.state || "",
    whatsapp: store.whatsapp || "",
    instagram: store.instagram || "",
    description: store.description || "",
    logoUrl: store.logoUrl || "",
    primaryColor: store.primaryColor || defaultStore.primaryColor,
    secondaryColor: store.secondaryColor || defaultStore.secondaryColor
  };
}

function buildCustomizationSnapshot(store: Store): CustomizationSnapshot {
  return {
    theme: store.theme,
    primaryColor: store.primaryColor || defaultStore.primaryColor,
    secondaryColor: store.secondaryColor || defaultStore.secondaryColor,
    bannerUrl: store.bannerUrl || "",
    slogan: store.slogan || "",
    aboutUs: store.aboutUs || "",
    facebook: store.facebook || "",
    instagram: store.instagram || "",
    whatsapp: store.whatsapp || "",
    openingHours: store.openingHours || "",
    address: store.address || "",
    mapEmbedUrl: store.mapEmbedUrl || ""
  };
}

function normalizeUrlInput(value?: string | null) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `https://${normalized}`;
}

function buildInstagramUrl(instagram?: string | null) {
  const normalized = (instagram || "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `https://instagram.com/${normalized.replace("@", "")}`;
}

function sanitizeHexColor(value: string, fallback: string) {
  return /^#([A-Fa-f0-9]{6})$/.test(value) ? value : fallback;
}

function extractWhatsappDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export function StoreSettingsPage() {
  const [store, setStore] = useState<Store>(defaultStore);
  const [loading, setLoading] = useState(true);

  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingCustomization, setSavingCustomization] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"identity" | "content">("identity");

  const [initialOnboarding, setInitialOnboarding] = useState<OnboardingSnapshot>(buildOnboardingSnapshot(defaultStore));
  const [initialCustomization, setInitialCustomization] = useState<CustomizationSnapshot>(
    buildCustomizationSnapshot(defaultStore)
  );

  useEffect(() => {
    api
      .get<Store>("/stores/me")
      .then((response) => {
        setStore(response.data);
        setInitialOnboarding(buildOnboardingSnapshot(response.data));
        setInitialCustomization(buildCustomizationSnapshot(response.data));
      })
      .catch(() => setError("Nao foi possivel carregar os dados da loja."))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof Store>(key: K, value: Store[K]) {
    setStore((prev) => ({ ...prev, [key]: value }));
  }

  function setAndClearMessage<K extends keyof Store>(key: K, value: Store[K]) {
    setMessage(null);
    setError(null);
    updateField(key, value);
  }

  function validateImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      return "Selecione apenas arquivos de imagem.";
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return "Arquivo acima de 8MB. Reduza o tamanho e tente novamente.";
    }

    return null;
  }

  async function uploadImage(
    file: File,
    endpoint: "/stores/me/upload/logo" | "/stores/me/upload/banner",
    field: "logoUrl" | "bannerUrl",
    setUploading: (value: boolean) => void,
    successMessage: string,
    fallbackError: string
  ) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    const data = new FormData();
    data.append("file", file);

    try {
      const response = await api.post(endpoint, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setStore((prev) => ({ ...prev, [field]: response.data.imageUrl }));
      setMessage(successMessage);
    } catch (err: any) {
      setError(err?.response?.data?.message || fallbackError);
    } finally {
      setUploading(false);
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    await uploadImage(
      file,
      "/stores/me/upload/logo",
      "logoUrl",
      setUploadingLogo,
      "Logo enviada com sucesso.",
      "Falha no upload da logo."
    );
  }

  async function handleBannerUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    await uploadImage(
      file,
      "/stores/me/upload/banner",
      "bannerUrl",
      setUploadingBanner,
      "Banner enviado com sucesso.",
      "Falha no upload do banner."
    );
  }
  async function persistOnboarding(silent = false) {
    setSavingOnboarding(true);
    if (!silent) {
      setError(null);
      setMessage(null);
    }

    const normalizedState = (store.state || "").toUpperCase().slice(0, 2);

    try {
      const response = await api.put("/stores/me/onboarding", {
        name: (store.name || "").trim(),
        city: (store.city || "").trim(),
        state: normalizedState,
        whatsapp: (store.whatsapp || "").trim(),
        instagram: (store.instagram || "").trim() || null,
        description: (store.description || "").trim().slice(0, MAX_DESCRIPTION) || null,
        logoUrl: store.logoUrl || null,
        primaryColor: sanitizeHexColor(store.primaryColor || "", defaultStore.primaryColor),
        secondaryColor: sanitizeHexColor(store.secondaryColor || "", defaultStore.secondaryColor)
      });

      const updatedStore: Store = response.data.store;
      setStore(updatedStore);
      setInitialOnboarding(buildOnboardingSnapshot(updatedStore));

      if (!silent) {
        setMessage("Identidade da loja salva com sucesso.");
      }

      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Nao foi possivel salvar identidade da loja.");
      return false;
    } finally {
      setSavingOnboarding(false);
    }
  }

  function normalizeOptionalUrlOrFail(rawValue?: string | null) {
    const raw = (rawValue || "").trim();
    if (!raw) {
      return { ok: true as const, value: null };
    }

    const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;

    try {
      const url = new URL(normalized);
      return { ok: true as const, value: url.toString() };
    } catch {
      return { ok: false as const, value: null };
    }
  }

  function normalizeMapInputOrFail(rawValue?: string | null) {
    const raw = (rawValue || "").trim();
    if (!raw) {
      return { ok: true as const, value: null };
    }

    // Se for URL, valida e salva como está
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const url = new URL(raw);
        return { ok: true as const, value: url.toString() };
      } catch {
        return { ok: false as const, value: null };
      }
    }

    // Endereço em texto — salva direto, a vitrine converte na exibição
    return { ok: true as const, value: raw };
  }

  async function persistCustomization(silent = false) {
    setSavingCustomization(true);
    if (!silent) {
      setError(null);
      setMessage(null);
    }

    const facebook = normalizeOptionalUrlOrFail(store.facebook);
    if (!facebook.ok) {
      setError("URL do Facebook invalida.");
      setSavingCustomization(false);
      return false;
    }

    const mapEmbedUrl = normalizeMapInputOrFail(store.mapEmbedUrl);
    if (!mapEmbedUrl.ok) {
      setError("Link ou endereco do mapa invalido.");
      setSavingCustomization(false);
      return false;
    }

    const bannerUrl = normalizeOptionalUrlOrFail(store.bannerUrl);
    if (!bannerUrl.ok) {
      setError("URL do banner invalida.");
      setSavingCustomization(false);
      return false;
    }

    try {
      const response = await api.put("/stores/me/customization", {
        theme: store.theme,
        primaryColor: sanitizeHexColor(store.primaryColor || "", defaultStore.primaryColor),
        secondaryColor: sanitizeHexColor(store.secondaryColor || "", defaultStore.secondaryColor),
        bannerUrl: bannerUrl.value,
        slogan: (store.slogan || "").trim().slice(0, MAX_SLOGAN) || null,
        aboutUs: (store.aboutUs || "").trim().slice(0, MAX_ABOUT) || null,
        facebook: facebook.value,
        instagram: (store.instagram || "").trim() || null,
        whatsapp: (store.whatsapp || "").trim() || null,
        openingHours: (store.openingHours || "").trim().slice(0, MAX_OPENING_HOURS) || null,
        address: (store.address || "").trim().slice(0, MAX_ADDRESS) || null,
        mapEmbedUrl: mapEmbedUrl.value
      });

      const updatedStore: Store = response.data.store;
      setStore(updatedStore);
      setInitialCustomization(buildCustomizationSnapshot(updatedStore));

      if (!silent) {
        setMessage("Conteudo e tema salvos com sucesso.");
      }

      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Nao foi possivel salvar personalizacao.");
      return false;
    } finally {
      setSavingCustomization(false);
    }
  }

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistOnboarding();
  }

  async function saveCustomization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistCustomization();
  }

  async function saveAll() {
    setError(null);
    setMessage(null);

    if (!onboardingDirty && !customizationDirty) {
      setMessage("Nenhuma alteracao pendente para salvar.");
      return;
    }

    const savedLabels: string[] = [];

    if (onboardingDirty) {
      const ok = await persistOnboarding(true);
      if (ok) {
        savedLabels.push("identidade");
      }
    }

    if (customizationDirty) {
      const ok = await persistCustomization(true);
      if (ok) {
        savedLabels.push("conteudo");
      }
    }

    if (savedLabels.length > 0) {
      setMessage(`Alteracoes salvas: ${savedLabels.join(" e ")}.`);
    }
  }

  function applyThemePreset(preset: ThemePreset) {
    setMessage(null);
    setError(null);
    setStore((prev) => ({
      ...prev,
      theme: preset.theme,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor
    }));
  }

  function resetThemePalette() {
    setStore((prev) => ({
      ...prev,
      theme: defaultStore.theme,
      primaryColor: defaultStore.primaryColor,
      secondaryColor: defaultStore.secondaryColor
    }));
  }

  async function copyPublicStoreUrl(publicStoreUrl: string) {
    try {
      await navigator.clipboard.writeText(publicStoreUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      setError("Nao foi possivel copiar o link. Copie manualmente pela URL exibida.");
    }
  }

  const previewStyles = useMemo(
    () => ({
      backgroundColor: store.secondaryColor || "#111111",
      color: store.primaryColor || "#C9A44C"
    }),
    [store.secondaryColor, store.primaryColor]
  );

  const onboardingSnapshot = useMemo(() => buildOnboardingSnapshot(store), [store]);
  const customizationSnapshot = useMemo(() => buildCustomizationSnapshot(store), [store]);

  const onboardingDirty = JSON.stringify(onboardingSnapshot) !== JSON.stringify(initialOnboarding);
  const customizationDirty = JSON.stringify(customizationSnapshot) !== JSON.stringify(initialCustomization);

  const savingAny = savingOnboarding || savingCustomization || uploadingLogo || uploadingBanner;

  const publicStoreUrl = useMemo(() => {
    const slug = store.slug || "minha-loja";
    return `${window.location.origin}/loja/${slug}`;
  }, [store.slug]);

  const instagramUrl = useMemo(() => buildInstagramUrl(store.instagram), [store.instagram]);
  const facebookUrl = useMemo(() => normalizeUrlInput(store.facebook), [store.facebook]);
  const whatsappDigits = useMemo(() => extractWhatsappDigits(store.whatsapp), [store.whatsapp]);

  const directWhatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  const shareOnWhatsappUrl = useMemo(() => {
    const text = encodeURIComponent(`Conheca a vitrine da ${store.name}: ${publicStoreUrl}`);
    return `https://wa.me/?text=${text}`;
  }, [store.name, publicStoreUrl]);

  const selectedPresetId = useMemo(() => {
    const preset = themePresets.find(
      (item) =>
        item.theme === store.theme &&
        item.primaryColor.toLowerCase() === (store.primaryColor || "").toLowerCase() &&
        item.secondaryColor.toLowerCase() === (store.secondaryColor || "").toLowerCase()
    );

    return preset?.id || null;
  }, [store.theme, store.primaryColor, store.secondaryColor]);

  const setupChecklist = useMemo(
    () => [
      { label: "Nome da loja", done: Boolean((store.name || "").trim()) },
      { label: "Logo", done: Boolean(store.logoUrl) },
      { label: "Banner", done: Boolean(store.bannerUrl) },
      { label: "Cidade e UF", done: Boolean((store.city || "").trim() && (store.state || "").trim()) },
      { label: "WhatsApp", done: Boolean(whatsappDigits) },
      { label: "Slogan", done: Boolean((store.slogan || "").trim()) },
      { label: "Sobre nos", done: Boolean((store.aboutUs || "").trim()) },
      { label: "Horario", done: Boolean((store.openingHours || "").trim()) },
      { label: "Endereco", done: Boolean((store.address || "").trim()) }
    ],
    [
      store.name,
      store.logoUrl,
      store.bannerUrl,
      store.city,
      store.state,
      store.slogan,
      store.aboutUs,
      store.openingHours,
      store.address,
      whatsappDigits
    ]
  );

  const checklistDone = setupChecklist.filter((item) => item.done).length;
  const checklistTotal = setupChecklist.length;
  const completionPercent = Math.round((checklistDone / checklistTotal) * 100);

  if (loading) {
    return <p className="text-zinc-400">Carregando configuracoes...</p>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
      <div className="space-y-6">
        <header className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl text-gold-300">Personalizacao da loja</h1>
              <p className="mt-2 text-sm text-zinc-400">
                Configure identidade, canais e conteudo com preview em tempo real para publicar uma vitrine mais
                profissional.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/5"
              >
                <ExternalLink size={14} />
                Abrir vitrine
              </a>
              <button
                type="button"
                onClick={saveAll}
                disabled={savingAny}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2 text-xs font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
              >
                {savingAny ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Salvar tudo
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Checklist de configuracao</p>
              <div className="mt-2 h-2 rounded-full bg-base-950/80">
                <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                {checklistDone}/{checklistTotal} itens concluidos ({completionPercent}%)
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-3 py-1 ${
                  onboardingDirty ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-200"
                }`}
              >
                Identidade: {onboardingDirty ? "pendente" : "salvo"}
              </span>
              <span
                className={`rounded-full px-3 py-1 ${
                  customizationDirty ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-200"
                }`}
              >
                Conteudo: {customizationDirty ? "pendente" : "salvo"}
              </span>
            </div>
          </div>
        </header>

        <div className="inline-flex rounded-xl border border-white/10 bg-base-900 p-1">
          <button
            type="button"
            onClick={() => setActiveSection("identity")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              activeSection === "identity" ? "bg-gold-400 text-base-950" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            Identidade da marca
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("content")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              activeSection === "content" ? "bg-gold-400 text-base-950" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            Conteudo e canais
          </button>
        </div>

        <form
          onSubmit={saveOnboarding}
          className={`rounded-2xl border p-5 ${
            activeSection === "identity" ? "border-gold-300/30 bg-base-900" : "border-white/10 bg-base-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-zinc-100">Identidade da marca</h2>
            <button
              type="submit"
              disabled={savingOnboarding || uploadingLogo}
              className="rounded-xl bg-gold-400 px-4 py-2 text-xs font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
            >
              {savingOnboarding ? "Salvando..." : "Salvar identidade"}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                required
                value={store.name}
                onChange={(event) => setAndClearMessage("name", event.target.value)}
                placeholder="Nome da loja"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />
              <input
                required
                value={store.city || ""}
                onChange={(event) => setAndClearMessage("city", event.target.value)}
                placeholder="Cidade"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />
              <input
                required
                value={store.state || ""}
                onChange={(event) => setAndClearMessage("state", event.target.value.toUpperCase().slice(0, 2))}
                placeholder="UF"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />
              <input
                required
                value={store.whatsapp || ""}
                onChange={(event) => setAndClearMessage("whatsapp", event.target.value)}
                placeholder="WhatsApp"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />
              <input
                value={store.instagram || ""}
                onChange={(event) => setAndClearMessage("instagram", event.target.value)}
                placeholder="Instagram (@usuario ou URL)"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl border border-white/15 bg-base-950 p-3 text-xs text-zinc-400">
                  Cor primaria
                  <input
                    type="color"
                    value={sanitizeHexColor(store.primaryColor || "", defaultStore.primaryColor)}
                    onChange={(event) => setAndClearMessage("primaryColor", event.target.value)}
                    className="mt-2 h-10 w-full"
                  />
                  <input
                    value={store.primaryColor || ""}
                    onChange={(event) => setAndClearMessage("primaryColor", event.target.value.toUpperCase())}
                    onBlur={() =>
                      setAndClearMessage(
                        "primaryColor",
                        sanitizeHexColor(store.primaryColor || "", defaultStore.primaryColor)
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-base-900 px-2 py-1 text-xs"
                  />
                </label>

                <label className="rounded-xl border border-white/15 bg-base-950 p-3 text-xs text-zinc-400">
                  Cor secundaria
                  <input
                    type="color"
                    value={sanitizeHexColor(store.secondaryColor || "", defaultStore.secondaryColor)}
                    onChange={(event) => setAndClearMessage("secondaryColor", event.target.value)}
                    className="mt-2 h-10 w-full"
                  />
                  <input
                    value={store.secondaryColor || ""}
                    onChange={(event) => setAndClearMessage("secondaryColor", event.target.value.toUpperCase())}
                    onBlur={() =>
                      setAndClearMessage(
                        "secondaryColor",
                        sanitizeHexColor(store.secondaryColor || "", defaultStore.secondaryColor)
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-base-900 px-2 py-1 text-xs"
                  />
                </label>
              </div>

              <div className="md:col-span-2">
                <textarea
                  value={store.description || ""}
                  onChange={(event) => setAndClearMessage("description", event.target.value.slice(0, MAX_DESCRIPTION))}
                  placeholder="Descricao curta da loja"
                  className="min-h-[110px] w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-right text-xs text-zinc-500">
                  {(store.description || "").length}/{MAX_DESCRIPTION}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block rounded-xl border border-dashed border-white/20 bg-base-950/55 p-3 text-sm text-zinc-200">
                <span className="inline-flex items-center gap-2">
                  <ImagePlus size={14} />
                  Upload de logo
                </span>
                <input type="file" accept="image/*" className="mt-2 block" onChange={handleLogoUpload} />
                <p className="mt-1 text-xs text-zinc-500">Recomendado: 600x600, fundo transparente.</p>
              </label>

              <label className="block rounded-xl border border-dashed border-white/20 bg-base-950/55 p-3 text-sm text-zinc-200">
                <span className="inline-flex items-center gap-2">
                  <ImagePlus size={14} />
                  Upload de banner
                </span>
                <input type="file" accept="image/*" className="mt-2 block" onChange={handleBannerUpload} />
                <p className="mt-1 text-xs text-zinc-500">Recomendado: 1600x500 para cabecalho da vitrine.</p>
              </label>

              <div className="rounded-xl border border-white/10 bg-base-950/60 p-3 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-200">Status de upload</p>
                <p className="mt-1">Logo: {uploadingLogo ? "enviando..." : store.logoUrl ? "ok" : "pendente"}</p>
                <p>Banner: {uploadingBanner ? "enviando..." : store.bannerUrl ? "ok" : "pendente"}</p>
              </div>
            </div>
          </div>
        </form>

        <form
          onSubmit={saveCustomization}
          className={`rounded-2xl border p-5 ${
            activeSection === "content" ? "border-gold-300/30 bg-base-900" : "border-white/10 bg-base-900"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-zinc-100">Conteudo, canais e tema</h2>
            <button
              type="submit"
              disabled={savingCustomization || uploadingBanner}
              className="rounded-xl bg-gold-400 px-4 py-2 text-xs font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
            >
              {savingCustomization ? "Salvando..." : "Salvar conteudo"}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/10 bg-base-950/55 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-sm text-zinc-200">
                  <Palette size={14} />
                  Presets de tema
                </p>
                <button
                  type="button"
                  onClick={resetThemePalette}
                  className="text-xs text-zinc-400 transition hover:text-zinc-200"
                >
                  Restaurar paleta padrao
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {themePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyThemePreset(preset)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedPresetId === preset.id
                        ? "border-gold-300/50 bg-gold-500/10"
                        : "border-white/10 bg-base-900/70 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{preset.name}</p>
                      {selectedPresetId === preset.id ? <Check size={14} className="text-gold-300" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{preset.description}</p>
                    <div className="mt-3 flex gap-2">
                      <span className="h-5 w-5 rounded-full border border-white/20" style={{ background: preset.primaryColor }} />
                      <span className="h-5 w-5 rounded-full border border-white/20" style={{ background: preset.secondaryColor }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={store.theme}
                onChange={(event) => setAndClearMessage("theme", event.target.value as Store["theme"])}
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              >
                <option value="LIGHT">Claro</option>
                <option value="DARK">Escuro</option>
                <option value="LUXURY">Luxo</option>
              </select>

              <input
                value={store.slogan || ""}
                onChange={(event) => setAndClearMessage("slogan", event.target.value.slice(0, MAX_SLOGAN))}
                placeholder="Slogan"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <div className="md:col-span-2">
                <textarea
                  value={store.aboutUs || ""}
                  onChange={(event) => setAndClearMessage("aboutUs", event.target.value.slice(0, MAX_ABOUT))}
                  placeholder="Sobre nos"
                  className="min-h-[120px] w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
                />
                <p className="mt-1 text-right text-xs text-zinc-500">
                  {(store.aboutUs || "").length}/{MAX_ABOUT}
                </p>
              </div>

              <input
                value={store.facebook || ""}
                onChange={(event) => setAndClearMessage("facebook", event.target.value)}
                placeholder="Facebook URL"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <input
                value={store.instagram || ""}
                onChange={(event) => setAndClearMessage("instagram", event.target.value)}
                placeholder="Instagram"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <input
                value={store.openingHours || ""}
                onChange={(event) =>
                  setAndClearMessage("openingHours", event.target.value.slice(0, MAX_OPENING_HOURS))
                }
                placeholder="Horario de funcionamento"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <input
                value={store.address || ""}
                onChange={(event) => setAndClearMessage("address", event.target.value.slice(0, MAX_ADDRESS))}
                placeholder="Endereco"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
              />

              <div className="md:col-span-2 space-y-2">
                <input
                  value={store.mapEmbedUrl || ""}
                  onChange={(event) => setAndClearMessage("mapEmbedUrl", event.target.value)}
                  placeholder="Cole o link do Google Maps aqui"
                  className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm"
                />
                <div className="rounded-xl border border-white/10 bg-base-950/60 p-3 text-xs text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-300">Como obter o link correto do mapa:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abra o Google Maps e busque o endereço da sua loja</li>
                    <li>Clique no local encontrado para abrir o painel lateral</li>
                    <li>Clique em <span className="text-zinc-200">Compartilhar</span> (icone de seta)</li>
                    <li>Escolha <span className="text-zinc-200">Incorporar um mapa</span> e copie apenas o link do atributo <code className="text-gold-300">src="..."</code></li>
                  </ol>
                  <p className="mt-2 text-zinc-500">Isso garante que o mapa mostra exatamente um unico local na vitrine.</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-base-950/60 p-3 text-xs text-zinc-400">
              <p className="inline-flex items-center gap-2 font-semibold text-zinc-200">
                <Wand2 size={14} />
                Dica de conversao
              </p>
              <p className="mt-1">
                Use um slogan direto (beneficio + confianca), inclua horario, endereco e um CTA no WhatsApp para subir
                taxa de contato.
              </p>
              <p className="mt-2 text-zinc-500">
                No mapa, voce pode colar endereco, link de compartilhamento ou link embed que o sistema adapta para a
                vitrine.
              </p>
            </div>
          </div>
        </form>

        {message ? <p className="text-sm text-green-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-base-900 p-4 text-sm text-zinc-300">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">URL publica</p>

          <a
            href={publicStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-base-950/70 px-3 py-2 text-gold-300 transition hover:border-gold-300/40 hover:bg-base-950"
          >
            <span className="truncate">{publicStoreUrl}</span>
            <ExternalLink size={15} className="shrink-0" />
          </a>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyPublicStoreUrl(publicStoreUrl)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/5"
            >
              {linkCopied ? (
                <>
                  <Check size={14} className="text-green-300" />
                  Link copiado
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copiar
                </>
              )}
            </button>

            <a
              href={shareOnWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/40 px-3 py-2 text-xs text-emerald-200 transition hover:bg-emerald-500/10"
            >
              <Share2 size={14} />
              Compartilhar
            </a>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-zinc-400">
            {directWhatsappUrl ? (
              <a href={directWhatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-zinc-100">
                <MessageCircle size={14} />
                WhatsApp da loja
              </a>
            ) : null}
            {instagramUrl ? (
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-zinc-100">
                <ExternalLink size={14} />
                Instagram da loja
              </a>
            ) : null}
            {facebookUrl ? (
              <a href={facebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-zinc-100">
                <ExternalLink size={14} />
                Facebook da loja
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-base-900 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Checklist</p>
          <div className="mt-3 space-y-2">
            {setupChecklist.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    item.done ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-700/70 text-zinc-300"
                  }`}
                >
                  {item.done ? "OK" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
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

            <div className="mt-4 rounded-xl border border-white/20 bg-black/20 p-3 text-xs">
              <p className="font-semibold">Preview rapido</p>
              <p className="mt-1">Tema: {store.theme}</p>
              <p>Primary: {store.primaryColor}</p>
              <p>Secondary: {store.secondaryColor}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
