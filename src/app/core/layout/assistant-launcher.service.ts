import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { ViewportService } from '../services/viewport.service';

/**
 * Opens and closes the Interactive Demo Assistant. Eager and tiny: the panel,
 * its protocol libraries (AG-UI, A2UI, Zod) and the demo agent load lazily the
 * first time it opens (`@defer` in the shell).
 */
@Injectable({ providedIn: 'root' })
export class AssistantLauncher {
  private readonly document = inject(DOCUMENT);
  private readonly viewport = inject(ViewportService);
  private returnFocus: HTMLElement | null = null;

  readonly isOpen = signal(false);
  /** Becomes true on first open and stays true, keeping the loaded panel (and its conversation) alive. */
  readonly loaded = signal(false);

  open(): void {
    if (this.isOpen()) return;
    this.returnFocus = this.document.activeElement as HTMLElement | null;
    this.loaded.set(true);
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) setTimeout(() => target.focus(), 0);
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  /** On narrow screens the panel covers the page, so following a link closes it. */
  closeIfOverlay(): void {
    if (!this.viewport.canDockPanel()) this.close();
  }
}
