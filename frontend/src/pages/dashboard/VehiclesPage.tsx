import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Copy, ExternalLink, FileText, Loader2, Search, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UpgradeModal } from "../../components/billing/UpgradeModal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { PlanUsage, Vehicle, VehicleImage } from "../../lib/types";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

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
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const storeSlug = user?.store?.slug;

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

  const [upgradeModalMessage, setUpgradeModalMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ vehicleId: string; label: string } | null>(null);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<string | null>(null);


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
      toast.error("Nao foi possivel carregar o estoque.");
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
      toast.error("Voce atingiu o limite de fotos para este veiculo no plano atual.");
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

      toast.error(reasons.join(" | "));
      return;
    }

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
      return;
    }

    if (statusCode === 423 && details?.code === "STORE_SUSPENDED") {
      toast.error("A loja esta suspensa. Operacoes de escrita estao bloqueadas.");
      return;
    }

    toast.error(typedError.response?.data?.message || fallbackMessage);
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

        toast.success("Veiculo atualizado com sucesso.");
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

        toast.success("Veiculo cadastrado com sucesso.");
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
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success("Veiculo removido com sucesso.");

      if (editingVehicleId === id) {
        resetEditor();
      }

      await Promise.all([loadVehicles(page, search, statusFilter), loadPlanUsage()]);
    } catch (err) {
      handleApiError(err, "Falha ao remover veiculo.");
    } finally {
      setConfirmDelete(null);
    }
  }

  function duplicateVehicle(vehicle: Vehicle) {
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
      status: "AVAILABLE",
      featured: false
    });
    setEditingVehicleId(null);
    setEditingVehicle(null);
    clearPendingImages();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Dados copiados. Ajuste o que precisar e salve como novo veiculo.");
  }

  function copyVehicleLink(vehicle: Vehicle) {
    if (!storeSlug) return;
    const url = `${window.location.origin}/loja/${storeSlug}/veiculos/${vehicle.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link do veiculo copiado!");
    });
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

    try {
      const response = await api.patch<{ images: VehicleImagePayload[] }>(
        `/vehicles/${editingVehicleId}/images/${imageId}/cover`
      );
      const images = normalizeImages(response.data.images);
      syncVehicleImages(editingVehicleId, images);
      toast.success("Capa atualizada.");
    } catch (err) {
      handleApiError(err, "Nao foi possivel definir a capa.");
    } finally {
      setProcessingImageId(null);
    }
  }

  async function removeVehicleImage(imageId: string) {
    if (!editingVehicleId) return;

    setProcessingImageId(imageId);

    try {
      const response = await api.delete<{ images: VehicleImagePayload[] }>(`/vehicles/${editingVehicleId}/images/${imageId}`);
      const images = normalizeImages(response.data.images);
      syncVehicleImages(editingVehicleId, images);
      toast.success("Imagem removida.");
    } catch (err) {
      handleApiError(err, "Nao foi possivel remover a imagem.");
    } finally {
      setProcessingImageId(null);
      setConfirmDeleteImage(null);
    }
  }

  async function updateVehicleStatus(vehicle: Vehicle, nextStatus: Vehicle["status"]) {
    if (vehicle.status === nextStatus) {
      return;
    }

    setUpdatingVehicleId(vehicle.id);

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

      toast.success("Status atualizado.");
    } catch (err) {
      handleApiError(err, "Falha ao atualizar status.");
    } finally {
      setUpdatingVehicleId(null);
    }
  }

  async function toggleVehicleFeatured(vehicle: Vehicle) {
    setUpdatingVehicleId(vehicle.id);

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

      toast.success(updated.featured ? "Veiculo marcado como destaque." : "Destaque removido.");
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

        <form className="mt-4 grid gap-6 xl:grid-cols-[1.3fr_1fr]" onSubmit={handleSubmit}>
          <div className="space-y-5">

            {/* Identificação */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Identificacao</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Marca <span className="text-red-400">*</span></span>
                  <input
                    required
                    value={form.brand}
                    onChange={(event) => updateForm("brand", event.target.value)}
                    placeholder="Ex: Toyota, Honda, BMW"
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Modelo <span className="text-red-400">*</span></span>
                  <input
                    required
                    value={form.model}
                    onChange={(event) => updateForm("model", event.target.value)}
                    placeholder="Ex: Corolla, Civic, X5"
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Ano de fabricacao <span className="text-red-400">*</span></span>
                  <input
                    required
                    type="number"
                    min={1950}
                    max={2100}
                    value={form.year}
                    onChange={(event) => updateForm("year", event.target.value)}
                    placeholder={String(new Date().getFullYear())}
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Cor <span className="text-red-400">*</span></span>
                  <input
                    required
                    value={form.color}
                    onChange={(event) => updateForm("color", event.target.value)}
                    placeholder="Ex: Prata, Preto, Branco"
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                  />
                </label>
              </div>
            </fieldset>

            {/* Ficha técnica */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Ficha tecnica</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Combustivel</span>
                  <select
                    value={form.fuel}
                    onChange={(event) => updateForm("fuel", event.target.value as Vehicle["fuel"])}
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none"
                  >
                    {fuelOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Cambio</span>
                  <select
                    value={form.transmission}
                    onChange={(event) => updateForm("transmission", event.target.value as Vehicle["transmission"])}
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none"
                  >
                    {transmissionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Quilometragem <span className="text-red-400">*</span></span>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min={0}
                      value={form.mileage}
                      onChange={(event) => updateForm("mileage", event.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-white/15 bg-base-950 py-2.5 pl-4 pr-12 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">km</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">Digite 0 para veiculo zero km</p>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Preco de venda <span className="text-red-400">*</span></span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">R$</span>
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(event) => updateForm("price", event.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-xl border border-white/15 bg-base-950 py-2.5 pl-10 pr-4 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600">Valor que aparece na vitrine para o cliente</p>
                </label>
              </div>
            </fieldset>

            {/* Status e visibilidade */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Status e visibilidade</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Status na vitrine</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value as Vehicle["status"])}
                    className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-600">Somente "Disponivel" aparece na vitrine publica</p>
                </label>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-400">Destaque</span>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-base-950/60 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(event) => updateForm("featured", event.target.checked)}
                      className="h-4 w-4 accent-yellow-400"
                    />
                    <div>
                      <p className="text-sm text-zinc-200">Marcar como destaque</p>
                      <p className="text-[11px] text-zinc-500">Aparece na secao de destaques da vitrine</p>
                    </div>
                  </label>
                </div>
              </div>
            </fieldset>

            {/* Descricao e opcionais */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Descricao e opcionais</legend>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-400">Descricao do veiculo <span className="text-red-400">*</span></span>
                <textarea
                  required
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Descreva o estado do veiculo, historico de manutencao, diferenciais..."
                  className="min-h-[110px] w-full rounded-xl border border-white/15 bg-base-950 px-4 py-3 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-400">Itens opcionais / acessorios</span>
                <input
                  value={form.optionalItems}
                  onChange={(event) => updateForm("optionalItems", event.target.value)}
                  placeholder="Ex: teto solar, camera 360, couro, multimidia"
                  className="w-full rounded-xl border border-white/15 bg-base-950 px-4 py-2.5 text-sm text-zinc-100 outline-none ring-gold-300 placeholder:text-zinc-600 transition focus:ring"
                />
                <p className="text-[11px] text-zinc-600">Separe cada item por virgula</p>
              </label>
            </fieldset>

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
                            onClick={() => setConfirmDeleteImage(image.id)}
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
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : vehiclesData && vehiclesData.items.length > 0 ? (
          <div className="mt-5 space-y-3">
            {vehiclesData.items.map((vehicle) => {
              const cover = vehicle.images.find((image) => image.isCover) || vehicle.images[0];
              const isUpdating = updatingVehicleId === vehicle.id;
              const fuelLabel = fuelOptions.find((f) => f.value === vehicle.fuel)?.label ?? vehicle.fuel;
              const transmissionLabel = transmissionOptions.find((t) => t.value === vehicle.transmission)?.label ?? vehicle.transmission;

              return (
                <article key={vehicle.id} className="rounded-2xl border border-white/10 bg-base-950/50 p-4 transition hover:border-white/20">
                  <div className="flex flex-col gap-4 md:flex-row">
                    {/* Foto */}
                    <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl md:w-52">
                      <img
                        src={cover?.url || "https://placehold.co/240x140?text=Sem+foto"}
                        alt={vehicle.model}
                        className="h-full w-full object-cover"
                      />
                      {vehicle.images.length > 1 && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
                          +{vehicle.images.length - 1} fotos
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-zinc-100">
                          {vehicle.brand} {vehicle.model} {vehicle.year}
                        </h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${getStatusBadge(vehicle.status)}`}>
                          {statusOptions.find((o) => o.value === vehicle.status)?.label ?? vehicle.status}
                        </span>
                        {vehicle.featured && (
                          <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-xs text-gold-200">
                            Destaque
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                        <span>{vehicle.mileage.toLocaleString("pt-BR")} km</span>
                        <span>{fuelLabel}</span>
                        <span>{transmissionLabel}</span>
                        <span>{vehicle.color}</span>
                      </div>

                      <p className="text-xl font-semibold text-gold-300">{formatCurrency(Number(vehicle.price))}</p>

                      <p className="line-clamp-2 text-sm text-zinc-400">{vehicle.description}</p>

                      {vehicle.optionalItems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {vehicle.optionalItems.slice(0, 4).map((item) => (
                            <span key={item} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                              {item}
                            </span>
                          ))}
                          {vehicle.optionalItems.length > 4 && (
                            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
                              +{vehicle.optionalItems.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 md:w-52">
                      {/* Status rápido */}
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

                      {/* Destaque */}
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => toggleVehicleFeatured(vehicle)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold-300/30 px-3 py-2 text-sm text-gold-200 transition hover:bg-gold-500/10 disabled:opacity-60"
                      >
                        {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                        {vehicle.featured ? "Remover destaque" : "Destaque"}
                      </button>

                      {/* Copiar link + vitrine */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => copyVehicleLink(vehicle)}
                          title="Copiar link do veiculo"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5"
                        >
                          <Copy size={13} />
                          Link
                        </button>
                        {storeSlug && (
                          <a
                            href={`/loja/${storeSlug}/veiculos/${vehicle.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver na vitrine"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/5"
                          >
                            <ExternalLink size={13} />
                            Vitrine
                          </a>
                        )}
                      </div>

                      {/* Editar + Duplicar */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(vehicle.id)}
                          className="rounded-xl border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateVehicle(vehicle)}
                          title="Duplicar este veiculo"
                          className="rounded-xl border border-white/15 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                        >
                          Duplicar
                        </button>
                      </div>

                      {/* Emitir NF-e */}
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/fiscal?veiculoId=${vehicle.id}`)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 px-3 py-2 text-sm text-blue-300 hover:bg-blue-400/10"
                      >
                        <FileText size={14} />
                        Emitir NF-e
                      </button>

                      {/* Excluir */}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ vehicleId: vehicle.id, label: `${vehicle.brand} ${vehicle.model} ${vehicle.year}` })}
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

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Excluir veiculo?"
        description={confirmDelete ? `"${confirmDelete.label}" sera removido permanentemente, incluindo todas as fotos.` : ""}
        confirmLabel="Sim, excluir"
        danger
        onConfirm={() => confirmDelete && removeVehicle(confirmDelete.vehicleId)}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteImage)}
        title="Remover imagem?"
        description="Esta imagem sera excluida permanentemente do veiculo."
        confirmLabel="Remover"
        danger
        onConfirm={() => confirmDeleteImage && removeVehicleImage(confirmDeleteImage)}
        onCancel={() => setConfirmDeleteImage(null)}
      />
    </div>
  );
}
