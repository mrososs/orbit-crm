import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const QUERIES = {
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  /** Wide enough to dock a side panel and keep ~790px for the page. */
  dock: '(min-width: 1440px)',
};

/** Responsive breakpoints as signals (mirrors Tailwind's md / lg / xl). */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly observer = inject(BreakpointObserver);

  private readonly state = toSignal(
    this.observer.observe(Object.values(QUERIES)).pipe(
      map((result) => ({
        md: result.breakpoints[QUERIES.md] ?? false,
        lg: result.breakpoints[QUERIES.lg] ?? false,
        xl: result.breakpoints[QUERIES.xl] ?? false,
        dock: result.breakpoints[QUERIES.dock] ?? false,
      })),
    ),
    {
      initialValue: {
        md: this.observer.isMatched(QUERIES.md),
        lg: this.observer.isMatched(QUERIES.lg),
        xl: this.observer.isMatched(QUERIES.xl),
        dock: this.observer.isMatched(QUERIES.dock),
      },
    },
  );

  readonly isMobile = computed(() => !this.state().md);
  readonly isTabletUp = computed(() => this.state().md);
  readonly isDesktop = computed(() => this.state().lg);
  readonly isWide = computed(() => this.state().xl);
  readonly canDockPanel = computed(() => this.state().dock);
}
