import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

/** A parameter that is itself a translation key, so it follows language switches. */
export interface TranslatedParam {
  translate: string;
}

export type ToastParams = Record<string, string | number | TranslatedParam>;

export interface ToastOptions {
  tone?: ToastTone;
  /** Translation key — resolved at render time so open toasts follow language switches. */
  title: string;
  message?: string;
  params?: ToastParams;
  action?: { label: string; run: () => void | Promise<void> };
  duration?: number;
}

export interface Toast extends Required<Pick<ToastOptions, 'tone' | 'title' | 'duration'>> {
  id: number;
  message?: string;
  params?: ToastParams;
  action?: ToastOptions['action'];
}

const MAX_VISIBLE = 4;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this._toasts.asReadonly();

  show(options: ToastOptions): number {
    const toast: Toast = {
      id: this.nextId++,
      tone: options.tone ?? 'success',
      title: options.title,
      message: options.message,
      params: options.params,
      action: options.action,
      duration: options.duration ?? (options.action ? 6500 : 4000),
    };
    this._toasts.update((list) => [...list, toast].slice(-MAX_VISIBLE));
    this.schedule(toast);
    return toast.id;
  }

  success(title: string, params?: ToastParams, action?: ToastOptions['action']): number {
    return this.show({ tone: 'success', title, params, action });
  }

  error(title: string, params?: ToastParams): number {
    return this.show({ tone: 'error', title, params, duration: 6000 });
  }

  info(title: string, params?: ToastParams): number {
    return this.show({ tone: 'info', title, params });
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  /** Pause auto-dismiss while hovered or focused (WCAG 2.2.1). */
  pause(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  resume(id: number): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (toast) this.schedule(toast, 2500);
  }

  private schedule(toast: Toast, override?: number): void {
    clearTimeout(this.timers.get(toast.id));
    this.timers.set(
      toast.id,
      setTimeout(() => this.dismiss(toast.id), override ?? toast.duration),
    );
  }
}
