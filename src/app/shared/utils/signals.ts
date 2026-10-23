import { DestroyRef, effect, inject, Signal, signal, untracked } from '@angular/core';

/**
 * Returns a signal that follows `source` after it has been stable for `ms`.
 * Must be called in an injection context.
 */
export function debounced<T>(source: Signal<T>, ms = 200): Signal<T> {
  const output = signal(untracked(source));
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  effect(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => output.set(value), ms);
  });
  return output.asReadonly();
}
