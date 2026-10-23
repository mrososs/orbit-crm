import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { STORAGE } from './platform';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export type PipelineView = 'board' | 'list';
export type RangePreset = 'last30' | 'last90' | 'last6m' | 'last12m' | 'ytd' | 'custom';

export interface Preferences {
  theme: ThemePreference;
  density: Density;
  dashboardRange: Exclude<RangePreset, 'custom'>;
  pipelineView: PipelineView;
  reduceMotion: boolean;
}

export const PREFERENCES_STORAGE_KEY = 'orbit-crm.preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  density: 'comfortable',
  dashboardRange: 'last6m',
  pipelineView: 'board',
  reduceMotion: false,
};

const ALLOWED: { [K in keyof Preferences]: readonly Preferences[K][] } = {
  theme: ['light', 'dark', 'system'],
  density: ['comfortable', 'compact'],
  dashboardRange: ['last30', 'last90', 'last6m', 'last12m', 'ytd'],
  pipelineView: ['board', 'list'],
  reduceMotion: [true, false],
};

/**
 * Visitor preferences. Stored separately from workspace data, so resetting the
 * demo dataset never touches theme, language or layout choices.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly storage = inject(STORAGE);
  private readonly state = signal<Preferences>(this.read());

  readonly preferences = this.state.asReadonly();
  readonly theme = computed(() => this.state().theme);
  readonly density = computed(() => this.state().density);
  readonly dashboardRange = computed(() => this.state().dashboardRange);
  readonly pipelineView = computed(() => this.state().pipelineView);
  readonly reduceMotion = computed(() => this.state().reduceMotion);

  constructor() {
    effect(() => {
      try {
        this.storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.state()));
      } catch {
        // Ignore storage failures; preferences still apply in memory.
      }
    });
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.state.update((prefs) => ({ ...prefs, [key]: value }));
  }

  private read(): Preferences {
    try {
      const raw = JSON.parse(this.storage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}') as Partial<Preferences>;
      const result = { ...DEFAULT_PREFERENCES };
      for (const key of Object.keys(ALLOWED) as (keyof Preferences)[]) {
        const value = raw[key];
        if ((ALLOWED[key] as readonly unknown[]).includes(value)) {
          (result as Record<string, unknown>)[key] = value;
        }
      }
      return result;
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
}
