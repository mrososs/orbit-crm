import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

let nextId = 0;

@Component({
  selector: 'ui-tooltip-panel',
  template: `{{ text() }}`,
  host: {
    role: 'tooltip',
    '[id]': 'id()',
    class:
      'pointer-events-none max-w-64 rounded-md bg-fg px-2 py-1 text-xs font-medium text-fg-inverse shadow-md animate-fade-in',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipPanel {
  readonly text = signal('');
  readonly id = signal('');
}

/**
 * Lightweight tooltip built on CDK Overlay. Appears on hover and keyboard focus,
 * hides on Escape; positions flip automatically and respect RTL.
 */
@Directive({
  selector: '[uiTooltip]',
  host: {
    '(mouseenter)': 'show(350)',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show(0)',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-describedby]': 'visible() ? id : null',
  },
})
export class Tooltip {
  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly uiTooltip = input<string>('');
  readonly tooltipPosition = input<'top' | 'bottom'>('top');

  protected readonly id = `ui-tooltip-${nextId++}`;
  protected readonly visible = signal(false);
  private ref: OverlayRef | null = null;
  private panel: TooltipPanel | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Keep an open tooltip in sync when its text changes (e.g. a toggled label).
    effect(() => {
      const text = this.uiTooltip();
      untracked(() => this.panel?.text.set(text));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.ref?.dispose();
    });
  }

  protected show(delayMs: number): void {
    if (!this.uiTooltip()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.attach(), delayMs);
  }

  protected hide(): void {
    clearTimeout(this.timer);
    this.ref?.detach();
    this.panel = null;
    this.visible.set(false);
  }

  private attach(): void {
    const top = this.tooltipPosition() === 'top';
    this.ref ??= this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withPositions([
          top
            ? { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 }
            : { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
          top
            ? { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 }
            : { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
        ])
        .withViewportMargin(8),
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    if (this.ref.hasAttached()) return;
    const panel = this.ref.attach(new ComponentPortal(TooltipPanel)).instance;
    panel.text.set(this.uiTooltip());
    panel.id.set(this.id);
    this.panel = panel;
    this.visible.set(true);
  }
}
