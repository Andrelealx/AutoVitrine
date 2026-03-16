import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Loader2, Search, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { UpgradeModal } from "../../components/billing/UpgradeModal";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { PlanUsage, Vehicle, VehicleImage } from "../../lib/types";

type VehiclesResponse = {
  items: Vehicle[];
  total: number;
  page: number;
  totalPages: number;
};

type SubscriptionResponse = {
  planUsage: PlanUsage;
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

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
  sizeLabel: string;
};

type VehicleImagePayload = {
  id: string;
  url: string;
  isCover: boolean;
};

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_UPLOAD_PER_REQUEST = 50;

const fuelOptions: Array<{ value: Vehicle["fuel"]; label: string }> = [
  { value: "FLEX", label: "Flex" },
  { value: "GASOLINE", label: "Gasolina" },
  { value: "DIESEL", label: "Diesel" },
  { value: "ELECTRIC", label: "Eletrico" },
  { value: "HYBRID", label: "Hibrido" }
];

const transmissionOptions: Array<{ value: Vehicle["transmission"]; label: string }> = [
  { value: "AUTOMATIC", label: "Automatico" },
  { value: "MANUAL", label: "Manual" },
  { value: "CVT", label: "CVT" },
  { value: "AUTOMATED", label: "Automatizado" }
];

const statusOptions: Array<{ value: Vehicle["status"]; label: string }> = [
  { value: "AVAILABLE", label: "Disponivel" },
  { value: "RESERVED", label: "Reservado" },
  { value: "SOLD", label: "Vendido" }
];

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

function toFormValues(vehicle: Vehicle): VehicleForm {
  return {
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
  };
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function normalizeImages(images: VehicleImagePayload[]) {
  return images.map((image) => ({
    id: image.id,
    url: image.url,
    isCover: Boolean(image.isCover)
  }));
}

export function VehiclesPage() {
  const [vehiclesData, setVehiclesData] = useState<VehiclesResponse | null>(null);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEditorVehicle, setLoadingEditorVehicle] = useState(false);
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusInput, setStatusInput] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [form, setForm] = useState<VehicleForm>(defaultForm);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const isEditing = Boolean(editingVehicleId);
  const planPhotoLimit = planUsage?.usage.photosPerVehicle.limit ?? null;
  const maxPendingByPlan = useMemo(() => {
    if (!isEditing || !planPhotoLimit) {
      return MAX_UPLOAD_PER_REQUEST;
    }

    const remaining = planPhotoLimit - (editingVehicle?.images.length || 0);
    return Math.max(0, Math.min(remaining, MAX_UPLOAD_PER_REQUEST));
  }, [isEditing, planPhotoLimit, editingVehicle?.images.length]);
  const availablePendingSlots = Math.max(0, maxPendingByPlan - pendingImages.length);

  async function loadPlanUsage() {
    const response = await api.get<SubscriptionResponse>("/subscriptions/me");
    setPlanUsage(response.data.planUsage);
  }

  async function loadVehicles(nextPage = page, nextSearch = search, nextStatus = statusFilter) {
    setLoading(true);

    try {
      const response = await api.get<VehiclesResponse>("/vehicles", {
        params: {
          page: nextPage,
          pageSize: 10,
          search: nextSearch || undefined,
          status: nextStatus || undefined
        }
      });

      setVehiclesData(response.data);
    } catch {
      setError("Nao foi possivel carregar o estoque.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlanUsage().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadVehicles(page, search, statusFilter);
  }, [page, search, statusFilter]);

  function updateForm<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearPendingImages() {
    pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingImages([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetEditor() {
    setEditingVehicleId(null);
    setEditingVehicle(null);
    setForm(defaultForm);
    clearPendingImages();
  }

  function buildPendingImage(file: File) {
    const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      sizeLabel: formatFileSize(file.size)
    };
  }
  function appendFiles(selectedFiles: File[]) {
    if (selectedFiles.length === 0) {
      return;
    }

    const validFiles: File[] = [];
    const rejected: string[] = [];

    selectedFiles.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name}: formato invalido`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: excede 8MB`);
        return;
      }

      validFiles.push(file);
    });

    if (availablePendingSlots <= 0) {
      setError("Voce atingiu o limite de fotos para este veiculo no plano atual.");
      return;
    }

    const filesToAdd = validFiles.slice(0, availablePendingSlots);
    const omittedByLimit = validFiles.length - filesToAdd.length;

    if (filesToAdd.length > 0) {
      setPendingImages((prev) => [...prev, ...filesToAdd.map(buildPendingImage)]);
    }

    if (rejected.length > 0 || omittedByLimit > 0) {
      const reasons = [...rejected];

      if (omittedByLimit > 0) {
        reasons.push(`${omittedByLimit} arquivo(s) ignorado(s) por limite de plano/requisicao`);
      }

      setError(reasons.join(" | "));
      return;
    }

    setError(null);
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    appendFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((item) => item.id !== id);
    });
  }

  function handleApiError(err: unknown, fallbackMessage: string) {
    const typedError = err as {
      response?: {
        status?: number;
        data?: {
          message?: string;
          details?: { code?: string };
        };
      };
    };

    const statusCode = typedError.response?.status;
    const details = typedError.response?.data?.details;

    if (statusCode === 402 && details?.code === "PLAN_LIMIT_REACHED") {
      setUpgradeModalMessage(typedError.response?.data?.message || fallbackMessage);
      setError(null);
      return;
    }

    if (statusCode === 423 && details?.code === "STORE_SUSPENDED") {
      setError("A loja esta suspensa. Operacoes de escrita estao bloqueadas.");
      return;
    }

    setError(typedError.response?.data?.message || fallbackMessage);
  }

  async function refreshVehiclesFromFirstPage() {
    if (page === 1) {
      await loadVehicles(1, search, statusFilter);
      return;
    }

    setPage(1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const optionalItems = form.optionalItems
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      if (isEditing && editingVehicleId) {
        await api.put(`/vehicles/${editingVehicleId}`, {
          brand: form.brand,
          model: form.model,
          year: Number(form.year),
          color: form.color,
          mileage: Number(form.mileage),
          fuel: form.fuel,
          transmission: form.transmission,
          price: Number(form.price),
          description: form.description,
          optionalItems,
          status: form.status,
          featured: form.featured
        });

        if (pendingImages.length > 0) {
          const fd = new FormData();
          pendingImages.forEach((item) => fd.append("images", item.file));

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
        pendingImages.forEach((item) => fd.append("images", item.file));

        await api.post("/vehicles", fd, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });

        setMessage("Veiculo cadastrado com sucesso.");
      }

      resetEditor();
      await Promise.all([refreshVehiclesFromFirstPage(), loadPlanUsage()]);
    } catch (err) {
      handleApiError(err, "Falha ao salvar veiculo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startEdit(vehicleId: string) {
    setLoadingEditorVehicle(true);
    setError(null);

    try {
      const response = await api.get<Vehicle>(`/vehicles/${vehicleId}`);
      const vehicle = response.data;
      setEditingVehicleId(vehicle.id);
      setEditingVehicle(vehicle);
      setForm(toFormValues(vehicle));
      clearPendingImages();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      handleApiError(err, "Falha ao carregar veiculo para edicao.");
    } finally {
      setLoadingEditorVehicle(false);
    }
  }

  async function removeVehicle(id: string) {
    if (!window.confirm("Deseja realmente remover este veiculo? Esta acao nao pode ser desfeita.")) {
      return;
    }

    try {
      await api.delete(`/vehicles/${id}`);
      setMessage("Veiculo removido com sucesso.");

      if (editingVehicleId === id) {
        resetEditor();
      }

      await Promise.all([loadVehicles(page, search, statusFilter), loadPlanUsage()]);
    } catch (err) {
      handleApiError(err, "Falha ao remover veiculo.");
    }
  }
  function syncVehicleImages(vehicleId: string, images: VehicleImage[]) {
    setEditingVehicle((prev) => (prev && prev.id === vehicleId ? { ...prev, images } : prev));

    setVehiclesData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        items: prev.items.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, images } : vehicle))
      };
    });
  }

  async function setCoverImage(imageId: string) {
    if (!editingVehicleId) {
      return;
    }

    setProcessingImageId(imageId);
    setError(null);

    try {
      const response = await api.patch<{ images: VehicleImagePayload[] }>(
        `/vehicles/${editingVehicleId}/images/${imageId}/cover`
      );
      const images = normalizeImages(response.data.images);
      syncVehicleImages(editingVehicleId, images);
      setMessage("Capa atualizada.");
    } catch (err) {
      handleApiError(err, "Nao foi possivel definir a capa.");
    } finally {
      setProcessingImageId(null);
    }
  }

  async function removeVehicleImage(imageId: string) {
    if (!editingVehicleId) {
      return;
    }

    if (!window.confirm("Remover esta imagem?")) {
      return;
    }

    setProcessingImageId(imageId);
    setError(null);

    try {
      const response = await api.delete<{ images: VehicleImagePayload[] }>(`/vehicles/${editingVehicleId}/images/${imageId}`);
      const images = normalizeImages(response.data.images);
      syncVehicleImages(editingVehicleId, images);
      setMessage("Imagem removida.");
    } catch (err) {
      handleApiError(err, "Nao foi possivel remover a imagem.");
    } finally {
      setProcessingImageId(null);
    }
  }

  async function updateVehicleStatus(vehicle: Vehicle, nextStatus: Vehicle["status"]) {
    if (vehicle.status === nextStatus) {
      return;
    }

    setUpdatingVehicleId(vehicle.id);
    setError(null);

    try {
      const response = await api.put<{ vehicle: Vehicle }>(`/vehicles/${vehicle.id}`, {
        status: nextStatus
      });
      const updated = response.data.vehicle;

      setVehiclesData((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          items: prev.items.map((item) => (item.id === vehicle.id ? updated : item))
        };
      });

      if (editingVehicleId === vehicle.id) {
        setEditingVehicle(updated);
        setForm((prev) => ({ ...prev, status: updated.status }));
      }

      setMessage("Status atualizado.");
    } catch (err) {
      handleApiError(err, "Falha ao atualizar status.");
    } finally {
      setUpdatingVehicleId(null);
    }
  }

  async function toggleVehicleFeatured(vehicle: Vehicle) {
    setUpdatingVehicleId(vehicle.id);
    setError(null);

    try {
      const response = await api.put<{ vehicle: Vehicle }>(`/vehicles/${vehicle.id}`, {
        featured: !vehicle.featured
      });
      const updated = response.data.vehicle;

      setVehiclesData((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          items: prev.items.map((item) => (item.id === vehicle.id ? updated : item))
        };
      });

      if (editingVehicleId === vehicle.id) {
        setEditingVehicle(updated);
        setForm((prev) => ({ ...prev, featured: updated.featured }));
      }

      setMessage(updated.featured ? "Veiculo marcado como destaque." : "Destaque removido.");
    } catch (err) {
      handleApiError(err, "Falha ao atualizar destaque.");
    } finally {
      setUpdatingVehicleId(null);
    }
  }

  function getStatusBadge(status: Vehicle["status"]) {
    if (status === "SOLD") {
      return "border-red-400/30 bg-red-500/10 text-red-200";
    }

    if (status === "RESERVED") {
      return "border-amber-300/30 bg-amber-500/10 text-amber-200";
    }

    return "border-emerald-300/30 bg-emerald-500/10 text-emerald-200";
  }

  const vehicleLimit = planUsage?.usage.vehicles.limit;
  const vehicleUsed = planUsage?.usage.vehicles.used || 0;
  const usagePercent = vehicleLimit ? Math.min(100, Math.round((vehicleUsed / vehicleLimit) * 100)) : null;
  const currentPhotoLimitLabel = planPhotoLimit ?? "Ilimitado";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-gold-300">Gestao de veiculos</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Cadastro intuitivo, edicao rapida e controle de fotos com capa em um unico fluxo.
          </p>
        </div>
        {isEditing ? (
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5"
          >
            <X size={16} />
            Voltar para novo cadastro
          </button>
        ) : null}
      </header>

      {planUsage ? (
        <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-200">
                Uso do plano: {vehicleUsed}/{vehicleLimit ?? "Ilimitado"} veiculos
              </p>
              <p className="mt-1 text-xs text-zinc-500">Limite de fotos por veiculo: {currentPhotoLimitLabel}</p>
            </div>
            <div className="min-w-[180px] flex-1">
              <div className="h-2 rounded-full bg-base-950/80">
                <div
                  className="h-full rounded-full bg-gold-400 transition-all"
                  style={{ width: usagePercent !== null ? `${usagePercent}%` : "32%" }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-zinc-500">
                {usagePercent !== null ? `${usagePercent}% do limite` : "Plano sem limite de veiculos"}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="rounded-2xl border border-white/10 bg-base-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-zinc-100">{isEditing ? "Editar veiculo" : "Novo veiculo"}</h2>
          {loadingEditorVehicle ? (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 size={14} className="animate-spin" />
              Carregando dados para edicao...
            </span>
          ) : null}
        </div>

        <form className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
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
                type="number"
                min={1950}
                max={2100}
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
                type="number"
                min={0}
                value={form.mileage}
                onChange={(event) => updateForm("mileage", event.target.value)}
                placeholder="KM"
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
              />
              <input
                required
                type="number"
                min={0}
                step="0.01"
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
                {fuelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={form.transmission}
                onChange={(event) => updateForm("transmission", event.target.value as Vehicle["transmission"])}
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
              >
                {transmissionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value as Vehicle["status"])}
                className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-base-950/60 px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => updateForm("featured", event.target.checked)}
                />
                Marcar como destaque
              </label>
            </div>

            <textarea
              required
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Descricao detalhada"
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />

            <input
              value={form.optionalItems}
              onChange={(event) => updateForm("optionalItems", event.target.value)}
              placeholder="Opcionais separados por virgula (ex: teto solar, camera 360, couro)"
              className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none ring-gold-300 transition focus:ring"
            />
          </div>
          <aside className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onDragEnter={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingUpload(true);
              }}
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingUpload(true);
              }}
              onDragLeave={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingUpload(false);
              }}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDraggingUpload(false);
                appendFiles(Array.from(event.dataTransfer.files || []));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`rounded-2xl border border-dashed p-4 transition ${
                isDraggingUpload
                  ? "border-gold-300 bg-gold-300/10"
                  : "border-white/20 bg-base-950/60 hover:border-gold-300/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-gold-400/15 p-2 text-gold-200">
                  <Upload size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Upload de fotos</p>
                  <p className="mt-1 text-xs text-zinc-400">Arraste imagens aqui ou clique para selecionar.</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    JPG/PNG/WEBP ate 8MB por arquivo, maximo {MAX_UPLOAD_PER_REQUEST} por envio.
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    Espaco disponivel para envio atual: <span className="text-gold-300">{availablePendingSlots}</span>
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={onFileInputChange}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/5"
              >
                <Camera size={14} />
                Selecionar fotos
              </button>
            </div>

            {pendingImages.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-base-950/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-200">Fotos prontas para envio ({pendingImages.length})</p>
                  <button
                    type="button"
                    onClick={clearPendingImages}
                    className="text-xs text-red-300 transition hover:text-red-200"
                  >
                    Limpar lista
                  </button>
                </div>

                <div className="grid max-h-[220px] gap-2 overflow-auto pr-1 sm:grid-cols-2">
                  {pendingImages.map((item) => (
                    <figure key={item.id} className="rounded-xl border border-white/10 bg-base-900/70 p-2">
                      <img src={item.previewUrl} alt={item.file.name} className="h-24 w-full rounded-lg object-cover" />
                      <figcaption className="mt-2">
                        <p className="truncate text-xs text-zinc-200">{item.file.name}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{item.sizeLabel}</span>
                          <button
                            type="button"
                            onClick={() => removePendingImage(item.id)}
                            className="inline-flex items-center gap-1 text-red-300"
                          >
                            <Trash2 size={12} />
                            Remover
                          </button>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {isEditing ? (
              <div className="rounded-2xl border border-white/10 bg-base-950/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm text-zinc-200">Fotos atuais do veiculo</p>
                  <p className="text-xs text-zinc-500">Use "Definir capa" para escolher a imagem principal.</p>
                </div>

                {editingVehicle?.images.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {editingVehicle.images.map((image) => (
                      <figure key={image.id} className="rounded-xl border border-white/10 bg-base-900/70 p-2">
                        <img src={image.url} alt="Foto do veiculo" className="h-24 w-full rounded-lg object-cover" />
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {image.isCover ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/20 px-2 py-1 text-gold-200">
                              <Check size={12} />
                              Capa
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={processingImageId === image.id}
                              onClick={() => setCoverImage(image.id)}
                              className="rounded-full border border-white/20 px-2 py-1 text-zinc-200 transition hover:bg-white/5 disabled:opacity-60"
                            >
                              Definir capa
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={processingImageId === image.id}
                            onClick={() => removeVehicleImage(image.id)}
                            className="rounded-full border border-red-300/30 px-2 py-1 text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
                          >
                            {processingImageId === image.id ? "Removendo..." : "Excluir"}
                          </button>
                        </div>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Este veiculo ainda nao possui fotos salvas.</p>
                )}
              </div>
            ) : null}
          </aside>

          <div className="xl:col-span-2 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <button
              type="submit"
              disabled={submitting || loadingEditorVehicle}
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {submitting ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Cadastrar veiculo"}
            </button>

            {isEditing ? (
              <button
                type="button"
                onClick={resetEditor}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
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
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-base-950 py-3 pl-9 pr-4 text-sm outline-none ring-gold-300 transition focus:ring"
                placeholder="Marca, modelo ou descricao"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.15em] text-zinc-500">Status</label>
            <select
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              className="rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm outline-none"
            >
              <option value="">Todos</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
              setStatusFilter(statusInput);
            }}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-200 hover:bg-white/5"
          >
            Filtrar
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setStatusInput("");
              setSearch("");
              setStatusFilter("");
              setPage(1);
            }}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5"
          >
            Limpar
          </button>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-zinc-400">Carregando estoque...</p>
        ) : vehiclesData && vehiclesData.items.length > 0 ? (
          <div className="mt-5 space-y-3">
            {vehiclesData.items.map((vehicle) => {
              const cover = vehicle.images.find((image) => image.isCover) || vehicle.images[0];
              const isUpdating = updatingVehicleId === vehicle.id;

              return (
                <article key={vehicle.id} className="rounded-2xl border border-white/10 bg-base-950/50 p-4">
                  <div className="flex flex-col gap-4 md:flex-row">
                    <img
                      src={cover?.url || "https://placehold.co/240x140?text=Sem+foto"}
                      alt={vehicle.model}
                      className="h-32 w-full rounded-xl object-cover md:w-52"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-100">
                          {vehicle.brand} {vehicle.model}
                        </h3>
                        <span className={`rounded-full border px-2 py-1 text-xs ${getStatusBadge(vehicle.status)}`}>
                          {statusOptions.find((option) => option.value === vehicle.status)?.label || vehicle.status}
                        </span>
                        {vehicle.featured ? (
                          <span className="rounded-full bg-gold-400/20 px-2 py-1 text-xs text-gold-200">Destaque</span>
                        ) : null}
                      </div>

                      <p className="text-sm text-zinc-400">
                        {vehicle.year} - {vehicle.mileage.toLocaleString("pt-BR")} km - {vehicle.transmission}
                      </p>
                      <p className="text-xl font-semibold text-gold-300">{formatCurrency(Number(vehicle.price))}</p>
                      <p className="line-clamp-2 text-sm text-zinc-400">{vehicle.description}</p>
                      <p className="text-xs text-zinc-500">
                        {vehicle.images.length} foto(s) cadastrada(s)
                        {vehicle.optionalItems.length > 0 ? ` | Opcionais: ${vehicle.optionalItems.slice(0, 3).join(", ")}` : ""}
                      </p>
                    </div>

                    <div className="space-y-2 md:w-56">
                      <select
                        value={vehicle.status}
                        disabled={isUpdating}
                        onChange={(event) => updateVehicleStatus(vehicle, event.target.value as Vehicle["status"])}
                        className="w-full rounded-xl border border-white/15 bg-base-900 px-3 py-2 text-sm outline-none disabled:opacity-60"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => toggleVehicleFeatured(vehicle)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold-300/30 px-3 py-2 text-sm text-gold-200 transition hover:bg-gold-500/10 disabled:opacity-60"
                      >
                        {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                        {vehicle.featured ? "Remover destaque" : "Marcar destaque"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(vehicle.id)}
                        className="w-full rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => removeVehicle(vehicle.id)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10"
                      >
                        <Trash2 size={14} />
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
          <p className="mt-5 text-sm text-zinc-400">Nenhum veiculo encontrado para os filtros aplicados.</p>
        )}
      </section>

      <UpgradeModal
        open={Boolean(upgradeModalMessage)}
        message={upgradeModalMessage || ""}
        onClose={() => setUpgradeModalMessage(null)}
      />
    </div>
  );
}
