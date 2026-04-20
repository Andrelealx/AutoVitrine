import { AlertTriangle } from "lucide-react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-base-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-2.5 ${danger ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-zinc-100">{title}</h3>
            {description && (
              <p className="mt-1.5 text-sm text-zinc-400">{description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              danger
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-gold-400 text-base-950 hover:bg-gold-300"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
