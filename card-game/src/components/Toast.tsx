// Toast 容器 — 固定右上角渲染所有通知
// 由 App.tsx 挂载

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useToastStore, type ToastType } from '../stores/toastStore';

const ICON_MAP: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'bg-green-600/90 border-green-500',
  error: 'bg-red-600/90 border-red-500',
  info: 'bg-slate-700/90 border-slate-600',
};

function ToastItem({ id, message, type }: { id: number; message: string; type: ToastType }) {
  const dismiss = useToastStore((s) => s.dismissToast);
  const Icon = ICON_MAP[type];

  return (
    <div
      data-testid={`toast-${type}`}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-white text-sm shadow-lg backdrop-blur-sm animate-in slide-in-from-right ${COLOR_MAP[type]}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
      <button
        onClick={() => dismiss(id)}
        className="ml-2 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      className="fixed top-16 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <ToastItem key={t.id} id={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </div>
  );
}
