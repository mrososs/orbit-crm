import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalDatePipe, NumberPipe } from '../../../shared/pipes/locale-pipes';
import { LoggedEvent, RunLog } from '../state/assistant.store';
import { AssistantStore } from '../state/assistant.store';

const CATEGORY: { test: RegExp; className: string }[] = [
  { test: /^(RUN|STEP)_/, className: 'bg-primary-soft text-primary-soft-fg' },
  { test: /^TEXT_/, className: 'bg-neutral-soft text-neutral-soft-fg' },
  { test: /^TOOL_/, className: 'bg-info-soft text-info-soft-fg' },
  { test: /^STATE_/, className: 'bg-warning-soft text-warning-soft-fg' },
  { test: /^ACTIVITY_/, className: 'bg-success-soft text-success-soft-fg' },
];

/**
 * Developer view of the protocol: every AG-UI event of every run, with its
 * payload, plus the agent state the client reconstructed from STATE events.
 */
@Component({
  selector: 'app-event-inspector',
  imports: [JsonPipe, LucideDynamicIcon, TranslatePipe, NumberPipe, LocalDatePipe],
  template: `
    <p class="text-xs leading-5 text-fg-muted">{{ 'assistant.inspector.intro' | translate }}</p>
    <p class="mt-1.5 flex items-start gap-1.5 text-2xs leading-4 text-fg-subtle" data-testid="inspector-latency">
      <svg lucideIcon="timer" [size]="12" class="mt-px shrink-0" aria-hidden="true"></svg>{{ 'assistant.inspector.latency' | translate }}
    </p>

    @if (store.runs().length === 0) {
      <p class="mt-6 text-center text-sm text-fg-muted" data-testid="inspector-empty">{{ 'assistant.inspector.empty' | translate }}</p>
    }

    <ol class="mt-3 flex flex-col gap-2" data-testid="inspector-runs">
      @for (run of store.runs(); track run.runId; let first = $first) {
        <li>
          <details class="group rounded-xl border border-line bg-surface" [open]="first" data-testid="inspector-run">
            <summary class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs">
              <svg lucideIcon="chevron-right" [size]="13" class="rtl-flip shrink-0 text-fg-subtle transition-transform group-open:rotate-90" aria-hidden="true"></svg>
              <span class="min-w-0 flex-1 truncate font-medium text-fg">{{ triggerLabel(run) | translate: { name: actionName(run) } }}</span>
              <span class="rounded px-1.5 py-0.5 text-2xs font-semibold" [class]="statusClass(run)" data-testid="inspector-run-status">{{ 'assistant.inspector.status.' + run.status | translate }}</span>
              <span class="text-fg-subtle tabular">{{ run.events.length | num }}</span>
            </summary>
            <div class="border-t border-line-subtle px-3 py-2">
              <p class="ltr-content mb-2 !text-left font-mono text-2xs text-fg-subtle">runId {{ run.runId }} · {{ asDate(run.startedAt) | localDate: 'time' }}@if (run.durationMs !== null) { · {{ run.durationMs | num }} ms}</p>
              @if (run.error) {
                <p class="mb-2 rounded bg-danger-soft px-2 py-1 font-mono text-2xs text-danger-soft-fg">{{ run.error }}</p>
              }
              <ol class="flex flex-col gap-1">
                @for (event of run.events; track event.seq) {
                  <li>
                    <details class="group/event">
                      <summary class="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 text-2xs hover:bg-surface-hover" data-testid="inspector-event" [attr.data-type]="event.type">
                        <span class="w-12 shrink-0 text-end text-fg-subtle tabular">+{{ event.offset | num }}</span>
                        <span class="ltr-content shrink-0 rounded px-1.5 py-0.5 font-mono font-semibold" [class]="typeClass(event.type)">{{ event.type }}</span>
                        <span class="ltr-content min-w-0 flex-1 truncate !text-left font-mono text-fg-muted">{{ summary(event) }}</span>
                        @if (!event.valid) {
                          <span class="shrink-0 font-semibold text-danger">{{ 'assistant.inspector.invalid' | translate }}</span>
                        }
                      </summary>
                      <pre class="ltr-content mt-1 mb-1.5 max-h-60 overflow-auto rounded-lg bg-surface-sunken p-2 !text-left font-mono text-2xs leading-relaxed text-fg-muted">{{ event.payload | json }}</pre>
                    </details>
                  </li>
                }
              </ol>
            </div>
          </details>
        </li>
      }
    </ol>

    <section class="mt-4" aria-labelledby="agent-state-title">
      <h3 id="agent-state-title" class="text-xs font-semibold text-fg">{{ 'assistant.inspector.state' | translate }}</h3>
      <p class="mt-0.5 text-2xs text-fg-muted">{{ 'assistant.inspector.stateHint' | translate }}</p>
      <pre class="ltr-content mt-1.5 max-h-48 overflow-auto rounded-lg border border-line-subtle bg-surface-sunken p-2 !text-left font-mono text-2xs text-fg-muted" data-testid="inspector-state">{{ store.agentState() | json }}</pre>
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventInspector {
  protected readonly store = inject(AssistantStore);

  protected asDate(ms: number): Date {
    return new Date(ms);
  }

  protected triggerLabel(run: RunLog): string {
    if (run.trigger.startsWith('action ')) return 'assistant.inspector.trigger.action';
    return run.trigger === 'suggestion' ? 'assistant.inspector.trigger.suggestion' : 'assistant.inspector.trigger.message';
  }

  protected actionName(run: RunLog): string {
    return run.trigger.replace(/^action /, '');
  }

  protected statusClass(run: RunLog): string {
    return {
      running: 'bg-info-soft text-info-soft-fg',
      success: 'bg-success-soft text-success-soft-fg',
      cancelled: 'bg-neutral-soft text-neutral-soft-fg',
      error: 'bg-danger-soft text-danger-soft-fg',
    }[run.status];
  }

  protected typeClass(type: string): string {
    return CATEGORY.find((c) => c.test.test(type))?.className ?? 'bg-neutral-soft text-neutral-soft-fg';
  }

  /** One-line description of an event for the collapsed row. */
  protected summary(event: LoggedEvent): string {
    const e = event.payload as Record<string, unknown>;
    switch (event.type) {
      case 'TEXT_MESSAGE_CONTENT':
      case 'TOOL_CALL_ARGS':
        return JSON.stringify(e['delta']);
      case 'TOOL_CALL_START':
        return String(e['toolCallName']);
      case 'TOOL_CALL_RESULT':
        return String(e['content']).slice(0, 80);
      case 'STEP_STARTED':
      case 'STEP_FINISHED':
        return String(e['stepName']);
      case 'ACTIVITY_SNAPSHOT': {
        const ops = (e['content'] as { a2ui_operations?: object[] } | undefined)?.a2ui_operations ?? [];
        return `${e['activityType']} · ${ops.map((op) => Object.keys(op).find((k) => k !== 'version')).join(', ')}`;
      }
      case 'ACTIVITY_DELTA':
        return `${e['activityType']} · ${(e['patch'] as unknown[] | undefined)?.length ?? 0} op(s)`;
      case 'STATE_DELTA':
        return ((e['delta'] as { op: string; path: string }[] | undefined) ?? []).map((d) => `${d.op} ${d.path}`).join(', ');
      case 'RUN_FINISHED':
        return `outcome: ${(e['outcome'] as { type?: string } | undefined)?.type ?? 'success'}`;
      case 'RUN_ERROR':
        return `${e['code'] ?? ''} ${e['message']}`;
      case 'CUSTOM':
        return `${e['name']} ${JSON.stringify(e['value'])}`;
      default:
        return '';
    }
  }
}
