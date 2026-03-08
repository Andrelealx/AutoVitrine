import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { formatCurrency, whatsappLink } from "../../lib/format";
import { Vehicle } from "../../lib/types";
import { useEffect } from "react";

type VehicleDetailsResponse = {
  store: {
    name: string;
    slug: string;
    whatsapp?: string | null;
    city?: string | null;
    state?: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  vehicle: Vehicle;
};

export function VehicleDetailsPage() {
  const { slug = "", vehicleId = "" } = useParams();

  const [data, setData] = useState<VehicleDetailsResponse | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/public/stores/${slug}/vehicles/${vehicleId}`).then((response) => setData(response.data));
  }, [slug, vehicleId]);

  const currentImage = useMemo(() => {
    if (!data) return null;
    return data.vehicle.images[currentImageIndex] || data.vehicle.images[0] || null;
  }, [data, currentImageIndex]);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;

    try {
      await api.post(`/public/stores/${slug}/leads`, {
        ...leadForm,
        vehicleId: data.vehicle.id
      });
      setFeedback("Interesse enviado com sucesso.");
      setLeadForm({ name: "", phone: "", email: "", message: "" });
    } catch {
      setFeedback("Nao foi possivel enviar o interesse agora.");
    }
  }

  if (!data) {
    return <div className="min-h-screen bg-base-950 p-8 text-zinc-300">Carregando veiculo...</div>;
  }

  const { store, vehicle } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: store.secondaryColor }}>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <Link to={`/loja/${store.slug}`} className="text-sm text-zinc-300 hover:text-white">
          ? Voltar para a vitrine
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full overflow-hidden rounded-2xl border border-white/10"
            >
              <img
                src={currentImage?.url || "https://placehold.co/1200x800?text=Sem+foto"}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="h-[420px] w-full object-cover"
              />
            </button>

            <div className="grid grid-cols-5 gap-2">
              {vehicle.images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setCurrentImageIndex(index)}
                  className={`overflow-hidden rounded-lg border ${
                    currentImageIndex === index ? "border-gold-300" : "border-white/15"
                  }`}
                >
                  <img src={image.url} alt="Miniatura" className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/35 p-5 text-zinc-100">
            <h1 className="font-display text-5xl">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="mt-3 text-3xl font-semibold" style={{ color: store.primaryColor }}>
              {formatCurrency(Number(vehicle.price))}
            </p>
            <p className="mt-2 text-sm text-zinc-300">
              {vehicle.year} • {vehicle.color} • {vehicle.mileage.toLocaleString("pt-BR")} km
            </p>
            <p className="text-sm text-zinc-300">
              Combustivel: {vehicle.fuel} • Cambio: {vehicle.transmission}
            </p>

            <p className="mt-4 text-sm leading-relaxed text-zinc-200">{vehicle.description}</p>

            {vehicle.optionalItems.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {vehicle.optionalItems.map((item) => (
                  <span key={item} className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-200">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {store.whatsapp ? (
                <a
                  href={whatsappLink(
                    store.whatsapp,
                    `Tenho interesse no ${vehicle.brand} ${vehicle.model} (${vehicle.year}) da loja ${store.name}.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-3 text-sm font-semibold"
                  style={{ backgroundColor: store.primaryColor, color: "#090909" }}
                >
                  Tenho interesse (WhatsApp)
                </a>
              ) : null}
            </div>

            <form onSubmit={submitLead} className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <h2 className="font-display text-2xl">Contato rapido</h2>
              <input
                required
                value={leadForm.name}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
              />
              <input
                required
                value={leadForm.phone}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Telefone"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
              />
              <input
                type="email"
                value={leadForm.email}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="E-mail (opcional)"
                className="w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
              />
              <textarea
                required
                value={leadForm.message}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Mensagem"
                className="min-h-[100px] w-full rounded-xl border border-white/15 bg-black/45 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ backgroundColor: store.primaryColor, color: "#090909" }}
              >
                Enviar interesse
              </button>
            </form>
            {feedback ? <p className="mt-2 text-sm text-zinc-300">{feedback}</p> : null}
          </section>
        </div>
      </div>

      {lightboxOpen && currentImage ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
        >
          <img src={currentImage.url} alt="Foto ampliada" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}