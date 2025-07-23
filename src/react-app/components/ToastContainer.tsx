import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.type];
        
        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            <div className="toast-content">
              <div className="toast-icon">
                <Icon size={20} />
              </div>
              <div className="toast-body">
                <div className="toast-title">{toast.title}</div>
                {toast.message && (
                  <div className="toast-message">{toast.message}</div>
                )}
              </div>
            </div>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}