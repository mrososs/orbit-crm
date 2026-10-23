import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

/**
 * Animates numeric changes (KPI transitions). Skips animation for reduced-motion
 * users and renders the final value for assistive technology immediately.
 */
@Component({
  selector: 'ui-count-up',
  template: `<span aria-hidden="true">{{ format()(display()) }}</span
    ><span class="sr-only">{{ format()(value()) }}</span>`,
  host: { class: 'tabular' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountUp {
  private readonly document = inject(DOCUMENT);

  readonly value = input.required<number>();
  readonly format = input<(value: number) => string>((v) => String(Math.round(v)));
  readonly duration = input(700);

  protected readonly display = signal(0);
  private frame = 0;
  private initialized = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));

    effect(() => {
      const target = this.value();
      untracked(() => this.animateTo(target));
    });
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.frame);
    const view = this.document.defaultView;
    const reduced =
      this.document.documentElement.classList.contains('reduce-motion') ||
      view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = this.initialized ? this.display() : target * 0.6;
    this.initialized = true;
    if (reduced || !view || from === target) {
      this.display.set(target);
      return;
    }

    const start = performance.now();
    const duration = this.duration();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.display.set(from + (target - from) * eased);
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
