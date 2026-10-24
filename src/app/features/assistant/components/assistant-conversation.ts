import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { renderText } from '../protocol/agent-text';
import { DemoCommandInput } from '../schemas/command.schemas';
import { ChatMessageView } from '../state/assistant.store';
import { AssistantStore } from '../state/assistant.store';
import { SurfaceSlot } from './surface-slot';

export interface Suggestion {
  key: string;
  command: DemoCommandInput;
  icon: string;
}

export const SUGGESTIONS: readonly Suggestion[] = [
  { key: 'assistant.suggestions.salesOverview', command: { intent: 'salesOverview' }, icon: 'chart-column' },
  { key: 'assistant.suggestions.topDeals', command: { intent: 'topDeals', scope: 'mine' }, icon: 'briefcase' },
  { key: 'assistant.suggestions.overdueTasks', command: { intent: 'overdueTasks' }, icon: 'calendar-clock' },
  { key: 'assistant.suggestions.createFollowUp', command: { intent: 'createFollowUp' }, icon: 'calendar-check' },
  { key: 'assistant.suggestions.dealsFilter', command: { intent: 'dealsFilter' }, icon: 'funnel' },
  { key: 'assistant.suggestions.moveDealStage', command: { intent: 'moveDealStage' }, icon: 'arrow-right-left' },
];

/** The message list: user turns, streamed agent text, tool activity and A2UI surfaces. */
@Component({
  selector: 'app-assistant-conversation',
  imports: [SurfaceSlot, LucideDynamicIcon, TranslatePipe],
  template: `
    @if (store.isEmpty()) {
      <div class="flex flex-col items-center px-2 pt-6 pb-2 text-center" data-testid="assistant-welcome">
        <span class="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg" aria-hidden="true">
          <svg lucideIcon="bot" [size]="24"></svg>
        </span>
        <h3 class="mt-3 text-base font-semibold text-fg">{{ 'assistant.welcome.title' | translate }}</h3>
        <p class="mt-1.5 max-w-xs text-sm leading-6 text-fg-muted">{{ 'assistant.welcome.text' | translate }}</p>
        <p class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-2.5 py-1 text-2xs font-medium text-fg-muted">
          <svg lucideIcon="info" [size]="12" aria-hidden="true"></svg>{{ 'assistant.welcome.disclaimer' | translate }}
        </p>
      </div>
    }

    <ol class="flex flex-col gap-3" [attr.aria-label]="'assistant.conversation' | translate">
      @for (message of store.messages(); track message.id) {
        @switch (message.role) {
          @case ('user') {
            <li class="flex justify-end" data-testid="assistant-message" data-role="user">
              <p class="max-w-[85%] rounded-2xl rounded-ee-md bg-primary px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-primary-fg [overflow-wrap:anywhere]">
                {{ message.text }}
              </p>
            </li>
          }
          @case ('assistant') {
            @if (message.text) {
              <li class="flex items-start gap-2" data-testid="assistant-message" data-role="assistant">
                <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg" aria-hidden="true">
                  <svg lucideIcon="bot" [size]="14"></svg>
                </span>
                <p class="min-w-0 rounded-2xl rounded-ss-md bg-surface-sunken px-3 py-2 text-sm leading-6 text-fg [overflow-wrap:anywhere]">
                  {{ display(message) }}@if (store.streamingId() === message.id) {<span class="ms-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-sm bg-primary motion-safe:animate-pulse" aria-hidden="true"></span>}
                </p>
              </li>
            }
            @if (message.tools.length) {
              <li class="flex flex-wrap gap-1.5 ps-8" data-testid="assistant-tools" [attr.aria-label]="'assistant.toolsUsed' | translate">
                @for (tool of message.tools; track $index) {
                  <span class="ltr-content inline-flex items-center gap-1 rounded-md border border-line-subtle bg-surface px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
                    <svg lucideIcon="braces" [size]="11" aria-hidden="true"></svg>{{ tool }}
                  </span>
                }
              </li>
            }
          }
          @case ('surface') {
            <li class="ps-8" data-testid="assistant-surface">
              <app-surface-slot [surfaceIds]="message.surfaceIds" [issues]="store.rejected()[message.id]" />
            </li>
          }
        }
      }
      @for (notice of store.notices(); track notice.id) {
        <li class="ms-8 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-soft-fg" role="alert" data-testid="assistant-notice">
          <p class="font-medium">{{ notice.key | translate }}</p>
          <p class="ltr-content mt-0.5 !text-left font-mono text-2xs opacity-80">{{ notice.detail }}</p>
        </li>
      }
      @if (failedRun(); as run) {
        <li class="ms-8 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-soft-fg" role="alert" data-testid="assistant-run-error">
          <p class="font-medium">{{ 'assistant.errors.runFailed' | translate }}</p>
          <p class="ltr-content mt-0.5 !text-left font-mono text-2xs opacity-80">{{ run.error }}</p>
        </li>
      }
    </ol>

    @if (store.running() && !store.streamingId()) {
      <p class="mt-3 flex items-center gap-2 ps-8 text-xs text-fg-muted" data-testid="assistant-status">
        <svg lucideIcon="loader-circle" [size]="14" class="motion-safe:animate-spin" aria-hidden="true"></svg>
        {{ (store.connecting() ? 'assistant.steps.connecting' : store.step() ? 'assistant.steps.' + store.step() : 'assistant.steps.thinking') | translate }}
      </p>
    }
    @if (cancelledLast()) {
      <p class="mt-2 ps-8 text-xs text-fg-muted" data-testid="assistant-cancelled">{{ 'assistant.cancelled' | translate }}</p>
    }

    @if (!store.running()) {
      <div class="mt-4" [class.mt-6]="store.isEmpty()">
        <p class="mb-2 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">{{ 'assistant.suggestions.title' | translate }}</p>
        <div class="flex flex-wrap gap-1.5">
          @for (s of suggestions; track s.key) {
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-start text-xs font-medium text-fg shadow-xs transition-colors hover:border-primary-border hover:bg-primary-soft"
              data-testid="assistant-suggestion"
              [attr.data-intent]="s.command.intent"
              (click)="suggest.emit(s)"
            >
              <svg [lucideIcon]="s.icon" [size]="13" class="text-primary-soft-fg" aria-hidden="true"></svg>{{ s.key | translate }}
            </button>
          }
        </div>
      </div>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantConversation {
  protected readonly store = inject(AssistantStore);
  private readonly language = inject(LanguageService);
  protected readonly suggestions = SUGGESTIONS;
  readonly suggest = output<Suggestion>();

  protected readonly failedRun = computed(() => {
    const latest = this.store.runs()[0];
    return latest?.status === 'error' ? latest : null;
  });
  protected readonly cancelledLast = computed(() => this.store.runs()[0]?.status === 'cancelled');

  /** Finished agent messages re-render from their translation key, so they follow language switches. */
  protected display(message: ChatMessageView): string {
    const i18n = this.store.i18n()[message.id];
    if (!i18n || this.store.streamingId() === message.id) return message.text;
    return renderText(i18n, { t: (k, p) => this.language.t(k, p), plural: (k, c, p) => this.language.plural(k, c, p) });
  }
}
