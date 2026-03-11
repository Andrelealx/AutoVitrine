import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { VehicleCard } from "../../components/storefront/VehicleCard";
import { api } from "../../lib/api";
import { Store, Vehicle } from "../../lib/types";

type StoreResponse = {
  store: Store;
  featuredVehicles: Vehicle[];
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: {
      name: string;
      isTrial: boolean;
      showTrialBanner: boolean;
      removeWatermark: boolean;
    };
  } | null;
  isSuspended: boolean;
};

type VehicleListResponse = {
  items: Vehicle[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    brands: string[];
    years: number[];
    fuels: string[];
    transmissions: string[];
  };
};

export function StorefrontPage() {
  const { slug = "" } = useParams();

  const [storeData, setStoreData] = useState<StoreResponse | null>(null);
  const [vehiclesData, setVehiclesData] = useState<VehicleListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);

  const [leadForm, setLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    message: ""
  });
  const [leadSent, setLeadSent] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);

  async function loadStore() {
    const response = await api.get(`/public/stores/${slug}`);
    setStoreData(response.data);
  }

  async function loadVehicles(nextPage = page) {
    const response = await api.get(`/public/stores/${slug}/vehicles`, {
      params: {
        page: nextPage,
        pageSize: 12,
        search: search || undefined,
        brand: brand || undefined,
        year: year || undefined,
        fuel: fuel || undefined,
        transmission: transmission || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined
      }
    });
    setVehiclesData(response.data);
  }

  useEffect(() => {
    Promise.all([loadStore(), loadVehicles(1)]).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const key = `autovitrine_session_${slug}`;
    const existing = localStorage.getItem(key);
    const sessionId = existing || crypto.randomUUID();
    localStorage.setItem(key, sessionId);

    api.post(`/public/stores/${slug}/views`, { sessionId }).catch(() => undefined);
  }, [slug]);

  const themeColors = useMemo(() => {
    const store = storeData?.store;
    return {
      primary: store?.primaryColor || "#C9A44C",
      secondary: store?.secondaryColor || "#111111"
    };
  }, [storeData]);

  async function handleLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await api.post(`/public/stores/${slug}/leads`, {
        name: leadForm.name,
        phone: leadForm.phone,
        email: leadForm.email || null,
        message: leadForm.message,
        vehicleId: null
      });

      setLeadForm({ name: "", phone: "", email: "", message: "" });
      setLeadSent("Mensagem enviada com sucesso. O lojista entrara em contato.");
      setLeadError(null);
    } catch (err: any) {
      setLeadError(err?.response?.data?.message || "Nao foi possivel enviar sua mensagem.");
    }
  }

  async function applyFilters() {
    setPage(1);
    await loadVehicles(1);
  }

  if (loading) {
    return <div className="min-h-screen bg-base-950 p-8 text-zinc-300">Carregando vitrine...</div>;
  }

  if (!storeData) {
    return <div className="min-h-screen bg-base-950 p-8 text-red-300">Loja nao encontrada.</div>;
  }

  const store = storeData.store;
  const hasTrialBanner =
    storeData.subscription?.plan.showTrialBanner && storeData.subscription?.status === "TRIALING";

  if (storeData.isSuspended || !store.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 p-8 text-center">
        <div className="max-w-xl rounded-2xl border border-white/10 bg-base-900 p-8">
          <h1 className="font-display text-4xl text-gold-300">{store.name}</h1>
          <p className="mt-3 text-zinc-300">
            {store.unavailableMessage || "Loja temporariamente indisponivel. Tente novamente mais tarde."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeColors.secondary }}>
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url(${store.bannerUrl || "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=1800&auto=format&fit=crop"})`
          }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-3xl rounded-3xl border border-white/20 bg-black/55 p-8 backdrop-blur">
            <div className="flex flex-wrap items-center gap-4">
              <img
                src={store.logoUrl || "https://placehold.co/90x90?text=Logo"}
                alt={store.name}
                className="h-16 w-16 rounded-full border border-white/20 object-cover"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-300">Vitrine digital</p>
                <h1 className="font-display text-5xl text-white">{store.name}</h1>
              </div>
            </div>
            <p className="mt-4 text-zinc-200">{store.slogan || store.description}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-zinc-300">
              {store.city && store.state ? <span>{store.city}/{store.state}</span> : null}
              {store.whatsapp ? <span>WhatsApp: {store.whatsapp}</span> : null}
              {store.instagram ? <span>Instagram: {store.instagram}</span> : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8">
        {hasTrialBanner ? (
          <section className="rounded-2xl border border-amber-200/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            Esta loja esta em periodo de teste. O trial expira em{" "}
            {storeData.subscription?.trialEndsAt
              ? new Date(storeData.subscription.trialEndsAt).toLocaleDateString("pt-BR")
              : "breve"}
            .
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-black/35 p-4 text-zinc-200 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar"
              className="lg:col-span-2 rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            />
            <select
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            >
              <option value="">Marca</option>
              {vehiclesData?.filters.brands.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            >
              <option value="">Ano</option>
              {vehiclesData?.filters.years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={fuel}
              onChange={(event) => setFuel(event.target.value)}
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            >
              <option value="">Combustivel</option>
              {vehiclesData?.filters.fuels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={transmission}
              onChange={(event) => setTransmission(event.target.value)}
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            >
              <option value="">Cambio</option>
              {vehiclesData?.filters.transmissions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Preco min"
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            />
            <input
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Preco max"
              className="rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={applyFilters}
            className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: themeColors.primary, color: "#090909" }}
          >
            Aplicar filtros
          </button>
        </section>

        {storeData.featuredVehicles.length > 0 ? (
          <section>
            <h2 className="font-display text-3xl" style={{ color: themeColors.primary }}>
              Destaques da loja
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {storeData.featuredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  slug={store.slug}
                  primaryColor={themeColors.primary}
                  secondaryColor={themeColors.secondary}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-display text-3xl" style={{ color: themeColors.primary }}>
            Todos os veiculos
          </h2>

          {vehiclesData && vehiclesData.items.length > 0 ? (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {vehiclesData.items.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    slug={store.slug}
                    primaryColor={themeColors.primary}
                    secondaryColor={themeColors.secondary}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between text-zinc-200">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const prev = page - 1;
                    setPage(prev);
                    loadVehicles(prev);
                  }}
                  className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <p className="text-sm text-zinc-300">
                  Pagina {vehiclesData.page} de {vehiclesData.totalPages}
                </p>
                <button
                  type="button"
                  disabled={page >= vehiclesData.totalPages}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    loadVehicles(next);
                  }}
                  className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-zinc-300">Nenhum veiculo encontrado com os filtros selecionados.</p>
          )}
        </section>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-black/35 p-5 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-3xl" style={{ color: themeColors.primary }}>
              Sobre a loja
            </h3>
            <p className="mt-3 text-zinc-200">{store.aboutUs || store.description || "Sem descricao."}</p>
            {store.openingHours ? <p className="mt-3 text-sm text-zinc-300">Horario: {store.openingHours}</p> : null}
            {store.address ? <p className="text-sm text-zinc-300">Endereco: {store.address}</p> : null}

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {store.whatsapp ? (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/25 px-3 py-2 text-zinc-100 hover:bg-white/10"
                >
                  WhatsApp
                </a>
              ) : null}
              {store.instagram ? (
                <a
                  href={
                    store.instagram.startsWith("http")
                      ? store.instagram
                      : `https://instagram.com/${store.instagram.replace("@", "")}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/25 px-3 py-2 text-zinc-100 hover:bg-white/10"
                >
                  Instagram
                </a>
              ) : null}
              {store.facebook ? (
                <a
                  href={store.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/25 px-3 py-2 text-zinc-100 hover:bg-white/10"
                >
                  Facebook
                </a>
              ) : null}
            </div>

            {store.mapEmbedUrl ? (
              <iframe
                src={store.mapEmbedUrl}
                className="mt-5 h-56 w-full rounded-xl border border-white/20"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Mapa da loja"
              />
            ) : null}
          </div>

          <div>
            <h3 className="font-display text-3xl" style={{ color: themeColors.primary }}>
              Fale com a loja
            </h3>
            <form className="mt-4 space-y-3" onSubmit={handleLeadSubmit}>
              <input
                required
                value={leadForm.name}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-zinc-100"
              />
              <input
                required
                value={leadForm.phone}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Telefone"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-zinc-100"
              />
              <input
                type="email"
                value={leadForm.email}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="E-mail (opcional)"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-zinc-100"
              />
              <textarea
                required
                value={leadForm.message}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Mensagem"
                className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm text-zinc-100"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ backgroundColor: themeColors.primary, color: "#090909" }}
              >
                Enviar mensagem
              </button>
            </form>

            {leadSent ? <p className="mt-3 text-sm text-green-300">{leadSent}</p> : null}
            {leadError ? <p className="mt-3 text-sm text-red-300">{leadError}</p> : null}
          </div>
        </section>
      </main>

      {!storeData.subscription?.plan.removeWatermark ? (
        <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-zinc-400">
          Powered by AutoVitrine - <Link to="/" className="text-gold-300">Criar minha vitrine</Link>
        </footer>
      ) : null}
    </div>
  );
}