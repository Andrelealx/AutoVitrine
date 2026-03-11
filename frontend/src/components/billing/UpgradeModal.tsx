import { Link } from "react-router-dom";

type UpgradeModalProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function UpgradeModal({ open, title, message, onClose }: UpgradeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-base-900 p-6 shadow-2xl">
        <h3 className="font-display text-3xl text-gold-300">{title || "Limite do plano atingido"}</h3>
        <p className="mt-3 text-sm text-zinc-300">{message}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/dashboard/assinatura"
            onClick={onClose}
            className="rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-base-950 transition hover:bg-gold-300"
          >
            Fazer upgrade
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm text-zinc-100 hover:bg-white/5"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
