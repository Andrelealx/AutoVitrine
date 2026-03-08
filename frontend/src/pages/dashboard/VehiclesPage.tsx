import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Vehicle } from "../../lib/types";

type VehiclesResponse = {
  items: Vehicle[];
  total: number;
  page: number;
  totalPages: number;
};

type VehicleForm = {
  brand: string;
  model: string;
  year: string;
  color: string;
  mileage: string;
  fuel: Vehicle["fuel"];
  transmission: Vehicle["transmission"];
  price: string;
  description: string;
  optionalItems: string;
  status: Vehicle["status"];
  featured: boolean;
};

const defaultForm: VehicleForm = {
  brand: "",
  model: "",
  year: String(new Date().getFullYear()),
  color: "",
  mileage: "0",
  fuel: "FLEX",
  transmission: "AUTOMATIC",
  price: "0",
  description: "",
  optionalItems: "",
  status: "AVAILABLE",
  featured: false
};

export function VehiclesPage() {
  const [vehiclesData, setVehiclesData] = useState<VehiclesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  const [form, setForm] = useState<VehicleForm>(defaultForm);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = useMemo(() => Boolean(editingVehicleId), [editingVehicleId]);

  async function loadVehicles(nextPage = page) {
    setLoading(true);
    try {
      const response = await api.get("/vehicles", {
        params: {
          page: nextPage,
          pageSize: 10,
          search: search || undefined,
          status: status || undefined
        }
      });
      setVehiclesData(response.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles(page);
  }, [page]);

  function updateForm<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const total = selected.slice(0, 15);
    setFiles(total);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (isEditing && editingVehicleId) {
        await api.put(`/vehicles/${editingVehicleId}`, {
          ...form,
          year: Number(form.year),
          mileage: Number(form.mileage),
          price: Number(form.price),
          optionalItems: form.optionalItems
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        });

        if (files.length > 0) {
          const fd = new FormData();
          files.forEach((file) => fd.append("images", file));
          await api.post(`/vehicles/${editingVehicleId}/images`, fd, {
            headers: {
              "Content-Type": "multipart/form-data"
            }
          });
        }

        setMessage("Veiculo atualizado com sucesso.");
      } else {
        const fd = new FormData();
        fd.append("brand", form.brand);
        fd.append("model", form.model);
        fd.append("year", form.year);
        fd.append("color", form.color);
        fd.append("mileage", form.mileage);
        fd.append("fuel", form.fuel);
        fd.append("transmission", form.transmission);
        fd.append("price", form.price);
        fd.append("description", form.description);
        fd.append("optionalItems", form.optionalItems);
        fd.append("status", form.status);
        fd.append("featured", String(form.featured));

        files.forEach((file) => fd.append("images", file));

        await api.post("/vehicles", fd, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });

        setMessage("Veiculo criado com sucesso.");
      }

      setForm(defaultForm);
      setFiles([]);
      setEditingVehicleId(null);
      await loadVehicles(1);
      setPage(1);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha ao salvar veiculo.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setForm({
      brand: vehicle.brand,
      model: vehicle.model,
      year: String(vehicle.year),
      color: vehicle.color,
      mileage: String(vehicle.mileage),
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      price: String(vehicle.price),
      description: vehicle.description,
      optionalItems: vehicle.optionalItems.join(", "),
      status: vehicle.status,
      featured: vehicle.featured
    });
    setFiles([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeVehicle(id: string) {
    if (!window.confirm("Deseja realmente remover este veiculo?")) {
      return;
    }

    try {
      await api.delete(`/vehicles/${id}`);
      setMessage("Veiculo removido.");
      await loadVehicles(page);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Falha ao remover.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-gold-300">Estoque de veiculos</h1>
        <p className="mt-2 text-sm text-zinc-400">Cadastre, edite e publique os carros da sua vitrine.</p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <h2 className="font-display text-2xl text-zinc-100">{isEditing ? "Editar veiculo" : "Novo veiculo"}</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
          <input
            required
            value={form.brand}
            onChange={(event) => updateForm("brand", event.target.value)}
            placeholder="Marca"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />
          <input
            required
            value={form.model}
            onChange={(event) => updateForm("model", event.target.value)}
            placeholder="Modelo"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />
          <input
            required
            value={form.year}
            onChange={(event) => updateForm("year", event.target.value)}
            placeholder="Ano"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />
          <input
            required
            value={form.color}
            onChange={(event) => updateForm("color", event.target.value)}
            placeholder="Cor"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />
          <input
            required
            value={form.mileage}
            onChange={(event) => updateForm("mileage", event.target.value)}
            placeholder="KM"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />
          <input
            required
            value={form.price}
            onChange={(event) => updateForm("price", event.target.value)}
            placeholder="Preco"
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />

          <select
            value={form.fuel}
            onChange={(event) => updateForm("fuel", event.target.value as Vehicle["fuel"])}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
          >
            <option value="FLEX">Flex</option>
            <option value="GASOLINE">Gasolina</option>
            <option value="DIESEL">Diesel</option>
            <option value="ELECTRIC">Eletrico</option>
            <option value="HYBRID">Hibrido</option>
          </select>

          <select
            value={form.transmission}
            onChange={(event) => updateForm("transmission", event.target.value as Vehicle["transmission"])}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
          >
            <option value="AUTOMATIC">Automatico</option>
            <option value="MANUAL">Manual</option>
            <option value="CVT">CVT</option>
            <option value="AUTOMATED">Automatizado</option>
          </select>

          <select
            value={form.status}
            onChange={(event) => updateForm("status", event.target.value as Vehicle["status"])}
            className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
          >
            <option value="AVAILABLE">Disponivel</option>
            <option value="SOLD">Vendido</option>
            <option value="RESERVED">Reservado</option>
          </select>

          <textarea
            required
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="Descricao"
            className="md:col-span-2 min-h-[120px] rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />

          <input
            value={form.optionalItems}
            onChange={(event) => updateForm("optionalItems", event.target.value)}
            placeholder="Opcionais separados por virgula"
            className="md:col-span-2 rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
          />

          <label className="md:col-span-2 flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => updateForm("featured", event.target.checked)}
            />
            Marcar como destaque
          </label>

          <label className="md:col-span-2 rounded-xl border border-dashed border-white/20 bg-base-950/40 p-4 text-sm text-zinc-300">
            Upload de fotos (ate 15)
            <input type="file" multiple accept="image/*" className="mt-2 block" onChange={handleFiles} />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:opacity-60"
            >
              {submitting ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Cadastrar veiculo"}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicleId(null);
                  setForm(defaultForm);
                  setFiles([]);
                }}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5"
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>

        {message ? <p className="mt-4 text-sm text-green-300">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs uppercase tracking-[0.15em] text-zinc-500">Busca</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
              placeholder="Marca, modelo, descricao"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.15em] text-zinc-500">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
            >
              <option value="">Todos</option>
              <option value="AVAILABLE">Disponivel</option>
              <option value="SOLD">Vendido</option>
              <option value="RESERVED">Reservado</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              loadVehicles(1);
            }}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5"
          >
            Filtrar
          </button>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-zinc-400">Carregando estoque...</p>
        ) : vehiclesData && vehiclesData.items.length > 0 ? (
          <div className="mt-5 space-y-3">
            {vehiclesData.items.map((vehicle) => {
              const cover = vehicle.images.find((image) => image.isCover) || vehicle.images[0];
              return (
                <article key={vehicle.id} className="rounded-2xl border border-white/10 bg-base-950/50 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <img
                      src={cover?.url || "https://placehold.co/240x140?text=Sem+foto"}
                      alt={vehicle.model}
                      className="h-32 w-full rounded-xl object-cover md:w-52"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-100">
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        {vehicle.featured ? (
                          <span className="rounded-full bg-gold-400/20 px-2 py-1 text-xs text-gold-200">Destaque</span>
                        ) : null}
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{vehicle.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        {vehicle.year} • {vehicle.mileage.toLocaleString("pt-BR")} km • {vehicle.transmission}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-gold-300">
                        {formatCurrency(Number(vehicle.price))}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(vehicle)}
                        className="rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVehicle(vehicle.id)}
                        className="rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <p className="text-sm text-zinc-400">
                Pagina {vehiclesData.page} de {vehiclesData.totalPages}
              </p>
              <button
                type="button"
                disabled={page >= vehiclesData.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-xl border border-white/20 px-3 py-2 text-sm disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-400">Nenhum veiculo cadastrado.</p>
        )}
      </section>
    </div>
  );
}