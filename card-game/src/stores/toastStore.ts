// Toast 通知系统
//
// 简单的全局通知：右上角悬浮显示，3s 自动消失
// 任何模块都能调用 showToast() 显示通知
//
// 使用方式：
//   useToastStore.getState().showToast('保存成功', 'success')

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastStore {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  showToast: (message, type = 'info', duration = 3000) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, type, duration }] });
    // 自动消失
    setTimeout(() => {
      get().dismissToast(id);
    }, duration);
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
