import { useEffect } from 'react';
import { Card } from './ui';
import styles from './Toast.module.css';

export interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  return (
    <Card className={`${styles.toast} ${styles[toast.type || 'info']}`}>
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.closeButton} onClick={() => onClose(toast.id)}>
        ×
      </button>
    </Card>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

