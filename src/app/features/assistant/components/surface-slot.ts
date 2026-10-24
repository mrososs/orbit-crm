import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SurfaceComponent } from '@a2ui/angular';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Where an AG-UI activity message's A2UI surfaces appear in the chat. A payload
 * rejected by validation is replaced by a safe error card — nothing from it is
 * rendered or executed.
 */
@Component({
  selector: 'app-surface-slot',
  imports: [SurfaceComponent, LucideDynamicIcon, TranslatePipe],
  template: `
    @if (issues(); as reasons) {
      <div class="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-danger-soft-fg" role="alert" data-testid="a2ui-rejected">
        <p class="flex items-center gap-2 text-sm font-semibold">
          <svg lucideIcon="triangle-alert" [size]="15" aria-hidden="true"></svg>{{ 'assistant.errors.rejectedTitle' | translate }}
        </p>
        <p class="mt-1 text-xs leading-5">{{ 'assistant.errors.rejectedText' | translate }}</p>
        <details class="mt-2 text-xs">
          <summary class="cursor-pointer font-medium">{{ 'assistant.errors.rejectedDetails' | translate }}</summary>
          <ul class="ltr-content mt-1.5 list-disc space-y-0.5 ps-4 !text-left font-mono text-2xs opacity-90">
            @for (reason of reasons; track $index) {
              <li>{{ reason }}</li>
            }
          </ul>
        </details>
      </div>
    } @else {
      @for (id of surfaceIds(); track id) {
        <a2ui-v09-surface class="block" [surfaceId]="id" [attr.data-surface]="id" data-testid="a2ui-surface" />
      }
    }
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurfaceSlot {
  readonly surfaceIds = input.required<string[]>();
  readonly issues = input<string[] | null>(null);
}
