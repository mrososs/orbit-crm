import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';

export type DialogSize = 'sm' | 'md' | 'lg';

const WIDTHS: Record<DialogSize, string> = { sm: '420px', md: '560px', lg: '720px' };

/**
 * Thin wrapper over CDK Dialog that applies Orbit's chrome, the active text
 * direction, and a drawer variant anchored to the inline-end edge.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly language = inject(LanguageService);

  open<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    options: { data?: D; size?: DialogSize; ariaLabel?: string } = {},
  ): DialogRef<R, C> {
    const config: DialogConfig<D, DialogRef<R, C>> = {
      data: options.data,
      direction: this.language.direction(),
      width: `min(${WIDTHS[options.size ?? 'md']}, calc(100vw - 2rem))`,
      maxHeight: 'calc(100dvh - 2rem)',
      panelClass: 'ui-dialog-pane',
      backdropClass: ['cdk-overlay-backdrop', 'ui-backdrop'],
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabel: options.ariaLabel,
    };
    return this.dialog.open<R, D, C>(component, config);
  }

  drawer<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    options: { data?: D; width?: string; ariaLabel?: string } = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data: options.data,
      direction: this.language.direction(),
      width: options.width ?? 'min(480px, 100vw)',
      height: '100dvh',
      maxHeight: '100dvh',
      panelClass: 'ui-drawer-pane',
      backdropClass: ['cdk-overlay-backdrop', 'ui-backdrop'],
      positionStrategy: this.overlay.position().global().end('0').top('0'),
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabel: options.ariaLabel,
    });
  }

  async result<R>(ref: DialogRef<R>): Promise<R | undefined> {
    return firstValueFrom(ref.closed);
  }
}
