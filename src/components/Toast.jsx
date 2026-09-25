import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react';

export default function Toast({ toast, onClose, onUndo }) {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3.5 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          {icons[toast.type || 'info']}
          <p className="text-sm font-medium text-slate-100 truncate">{toast.message}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {toast.undoAction && onUndo && (
            <button
              onClick={() => onUndo(toast.undoAction)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
            >
              <Undo2 className="w-3.5 h-3.5" />
              UNDO
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
