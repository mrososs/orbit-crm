import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { InterpolationParameters, TranslatePipe } from '@ngx-translate/core';
import { Button } from '../button';
import { DialogFrame } from './dialog-frame';
import { DialogService } from './dialog.service';

export interface ConfirmOptions {
  /** Translation keys. */
  title: string;
  message: string;
  confirmLabel?: string;
  params?: InterpolationParameters;
  tone?: 'default' | 'danger';
  icon?: string;
  /** Optional async work run before closing — the button shows a spinner. */
  onConfirm?: () => Promise<void>;
}

@Component({
  selector: 'ui-confirm-dialog',
  imports: [DialogFrame, Button, TranslatePipe],
  template: `
    <ui-dialog-frame
      [heading]="data.title | translate: data.params"
      [icon]="data.icon ?? (data.tone === 'danger' ? 'triangle-alert' : 'info')"
      [tone]="data.tone ?? 'default'"
    >
      <p class="text-sm leading-6 text-fg-muted">{{ data.message | translate: data.params }}</p>
      @if (failed()) {
        <p class="mt-3 text-sm text-danger" role="alert">{{ 'errors.generic' | translate }}</p>
      }
      <ng-container dialogFooter>
        <button ui-button type="button" (click)="ref.close(false)" [disabled]="busy()">
          {{ 'common.cancel' | translate }}
        </button>
        <button
          ui-button
          type="button"
          [variant]="data.tone === 'danger' ? 'danger' : 'primary'"
          [loading]="busy()"
          (click)="confirm()"
          data-testid="confirm-button"
        >
          {{ (data.confirmLabel ?? 'common.confirm') | translate }}
        </button>
      </ng-container>
    </ui-dialog-frame>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async confirm(): Promise<void> {
    if (!this.data.onConfirm) {
      this.ref.close(true);
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    try {
      await this.data.onConfirm();
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialogs = inject(DialogService);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialogs.open<boolean, ConfirmOptions>(ConfirmDialog, { data: options, size: 'sm' });
    return (await this.dialogs.result(ref)) === true;
  }
}
