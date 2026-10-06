import { create } from 'zustand';

export type ModalVariant = 'danger' | 'warning' | 'info' | 'success' | 'reboot';

export interface ConfirmOptions {
  title?: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
  icon?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ConfirmState {
  // Modal State
  isOpen: boolean;
  options: ConfirmOptions | null;
  isLoading: boolean;
  confirm: (options: ConfirmOptions) => void;
  close: () => void;
  setLoading: (loading: boolean) => void;

  // Toast State
  toasts: ToastMessage[];
  showToast: (message: string | { message?: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' }, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  isLoading: false,

  confirm: (options) => {
    set({
      isOpen: true,
      options,
      isLoading: false,
    });
  },

  close: () => {
    set({ isOpen: false, options: null, isLoading: false });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  toasts: [],

  showToast: (message: string | { message?: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' }, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    let msgText = '';
    let toastType = type;

    if (typeof message === 'object' && message !== null) {
      if (message.title && message.message) {
        msgText = `${message.title}: ${message.message}`;
      } else {
        msgText = message.message || message.title || '';
      }
      if (message.type) toastType = message.type;
    } else {
      msgText = String(message || '');
    }

    set((state) => ({
      toasts: [...state.toasts, { id, message: msgText, type: toastType }],
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Quick helper utilities for easy invocation anywhere
export const confirmAction = (options: ConfirmOptions) => {
  useConfirmStore.getState().confirm(options);
};

export const notify = (
  messageOrObj: string | { message?: string; title?: string; type?: 'success' | 'error' | 'warning' | 'info' },
  type: 'success' | 'error' | 'warning' | 'info' = 'success'
) => {
  useConfirmStore.getState().showToast(messageOrObj, type);
};
