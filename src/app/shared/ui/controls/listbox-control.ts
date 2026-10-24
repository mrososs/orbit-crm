import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  afterRenderEffect,
  computed,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  Signal,
  signal,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { ControlBase } from './control-base';
import { SelectOption } from './select-option';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Shared behaviour of the dropdown (`ui-select`) and the searchable select
 * (`ui-combobox`): a listbox popup in a CDK overlay, the highlighted option
 * (`aria-activedescendant`) and keyboard movement. Focus never leaves the
 * control, so screen readers and form focus management keep working.
 *
 * The popup uses the `Overlay` service rather than `cdkConnectedOverlay`: the
 * service is already in the initial bundle (CDK Menu), the directive is not.
 */
@Directive()
export abstract class ListboxControl extends ControlBase implements FormValueControl<string> {
  protected readonly document = inject(DOCUMENT);
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);

  readonly value = model('');
  readonly options = input<readonly SelectOption[]>([]);

  /** Element the popup aligns with. */
  protected abstract readonly origin: Signal<ElementRef<HTMLElement>>;
  protected abstract readonly panel: Signal<TemplateRef<unknown>>;
  /** Options currently listed in the popup. */
  protected abstract readonly visibleOptions: Signal<readonly SelectOption[]>;

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  private overlayRef: OverlayRef | null = null;
  private stopFollowingScroll?: () => void;

  protected readonly listboxId = computed(() => `${this.controlId()}-listbox`);
  protected readonly optionIdPrefix = computed(() => `${this.controlId()}-option-`);
  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected readonly activeOptionId = computed(() =>
    this.open() && this.activeIndex() >= 0 && this.activeIndex() < this.visibleOptions().length
      ? `${this.optionIdPrefix()}${this.activeIndex()}`
      : null,
  );

  constructor() {
    super();
    // Keep the highlighted option visible while navigating with the keyboard.
    afterRenderEffect(() => {
      const id = this.activeOptionId();
      if (id) this.document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
    // The list height can change (filtering); re-run positioning so it prefers opening below.
    afterRenderEffect(() => {
      this.visibleOptions();
      if (this.open()) this.overlayRef?.updatePosition();
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopFollowingScroll?.();
      this.overlayRef?.dispose();
    });
  }

  protected get interactive(): boolean {
    return !this.disabled() && !this.readonly() && !this.loading();
  }

  /** Opens the popup, highlighting the selected option (or the first / last one). */
  protected openList(highlight: 'selected' | 'first' | 'last' = 'selected'): void {
    if (!this.interactive) return;
    if (!this.open()) {
      this.attachPanel();
      this.followScroll();
      this.open.set(true);
    }
    const options = this.visibleOptions();
    const selectedIndex = options.findIndex((o) => o.value === this.value());
    if (highlight === 'last') this.activeIndex.set(this.firstEnabled(options.length - 1, -1));
    else if (highlight === 'selected' && selectedIndex >= 0) this.activeIndex.set(selectedIndex);
    else this.activeIndex.set(this.firstEnabled(0, 1));
  }

  close(): void {
    this.stopFollowingScroll?.();
    this.stopFollowingScroll = undefined;
    this.overlayRef?.detach();
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  /** Moves the highlight; stays put at either end. */
  protected move(step: 1 | -1): void {
    const next = this.firstEnabled(this.activeIndex() + step, step);
    if (next >= 0) this.activeIndex.set(next);
  }

  protected pick(option: SelectOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.close();
  }

  /** Index of the first enabled option from `start` in `step` direction, or -1. */
  protected firstEnabled(start: number, step: 1 | -1): number {
    const options = this.visibleOptions();
    for (let i = start; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) return i;
    }
    return -1;
  }

  private attachPanel(): void {
    const origin = this.origin().nativeElement;
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(origin)
          .withPositions(POSITIONS)
          .withFlexibleDimensions(false)
          .withPush(false),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
      });
      this.overlayRef.outsidePointerEvents().subscribe((event) => {
        if (!origin.contains(event.target as Node)) this.close();
      });
    }
    // At least as wide as the control; wider labels may extend it (compact filters).
    this.overlayRef.updateSize({ minWidth: Math.max(origin.getBoundingClientRect().width, 176) });
    if (!this.overlayRef.hasAttached()) this.overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainer));
  }

  /**
   * The CDK reposition strategy follows the window and registered `cdkScrollable`s
   * only. Scrolling dialog bodies or the assistant conversation would leave the
   * popup behind, so any scroll outside the popup re-anchors it to the control.
   */
  private followScroll(): void {
    const reposition = (event: Event) => {
      if (!this.overlayRef?.overlayElement.contains(event.target as Node)) this.overlayRef?.updatePosition();
    };
    this.document.addEventListener('scroll', reposition, { capture: true, passive: true });
    this.stopFollowingScroll = () => this.document.removeEventListener('scroll', reposition, { capture: true });
  }
}
