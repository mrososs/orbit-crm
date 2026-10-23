import { InjectionToken } from '@angular/core';

/** Current time source. Overridden in tests for deterministic date math. */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/**
 * Key/value storage used for demo persistence. Falls back to memory when
 * `localStorage` is unavailable (e.g. privacy modes or blocked storage).
 */
export const STORAGE = new InjectionToken<Storage>('STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      const probe = '__orbit_probe__';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return localStorage;
    } catch {
      return new MemoryStorage();
    }
  },
});

export class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Simulated network latency for the mock repositories (ms). */
export interface MockLatency {
  read: number;
  write: number;
}

export const MOCK_LATENCY = new InjectionToken<MockLatency>('MOCK_LATENCY', {
  providedIn: 'root',
  factory: () => ({ read: 320, write: 90 }),
});

export const delay = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
