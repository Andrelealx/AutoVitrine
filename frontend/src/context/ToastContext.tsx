import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info
};

const styles: Record<ToastType, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  info: "border-gold-400/30 bg-gold-400/10 text-gold-200"
};

const iconStyles: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-gold-400"
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Anima entrada
    const show = setTimeout(() => setVisible(true), 10);

    // Auto-remove
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration ?? 3500);

    return () => {
      clearTimeout(show);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onRemove]);

  const Icon = icons[toast.type];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl transition-all duration-300 ${styles[toast.type]} ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconStyles[toast.type]}`} />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => onRemove(toast.id), 300);
        }}
        className="shrink-0 opacity-60 transition hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const success = useCallback((message: string) => toast(message, "success"), [toast]);
  const error = useCallback((message: string) => toast(message, "error", 5000), [toast]);
  const warning = useCallback((message: string) => toast(message, "warning"), [toast]);
  const info = useCallback((message: string) => toast(message, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
