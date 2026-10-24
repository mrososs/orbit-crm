import { A11yModule } from '@angular/cdk/a11y';
import { A2UI_RENDERER_CONFIG, A2uiRendererService } from '@a2ui/angular';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AssistantLauncher } from '../../core/layout/assistant-launcher.service';
import { CLOCK } from '../../core/services/platform';
import { ViewportService } from '../../core/services/viewport.service';
import { Tabs } from '../../shared/ui/tabs';
import { AssistantComposer } from './components/assistant-composer';
import { AssistantConversation, Suggestion } from './components/assistant-conversation';
import { EventInspector } from './components/event-inspector';
import { createOrbitCatalog } from './renderer/orbit-catalog';
import { AssistantActionDispatcher } from './services/action-dispatcher';
import { AssistantSession } from './services/assistant-session';
import { AssistantTools, CrmAssistantTools } from './services/assistant-tools';
import { AssistantStore } from './state/assistant.store';

/**
 * The Interactive Demo Assistant panel. Lazy-loaded by the shell (`@defer`) the
 * first time the assistant opens, together with AG-UI, A2UI and Zod.
 *
 * Wide screens dock it beside the page (non-modal, so CRM screens can be seen
 * updating); narrower screens show it as a modal drawer with a focus trap.
 * It stays mounted once loaded, so the conversation survives closing.
 */
@Component({
  selector: 'app-assistant-panel',
  imports: [A11yModule, LucideDynamicIcon, TranslatePipe, Tabs, AssistantConversation, AssistantComposer, EventInspector],
  providers: [
    AssistantStore,
    AssistantActionDispatcher,
    { provide: AssistantTools, useClass: CrmAssistantTools },
    {
      provide: A2UI_RENDERER_CONFIG,
      useFactory: () => {
        const dispatcher = inject(AssistantActionDispatcher);
        return {
          catalogs: [createOrbitCatalog(inject(LanguageService), inject(CLOCK))],
          actionHandler: (action: unknown) => dispatcher.dispatch(action),
        };
      },
    },
    A2uiRendererService,
    AssistantSession,
  ],
  template: `
    @if (overlay() && launcher.isOpen()) {
      <div class="ui-backdrop fixed inset-0 z-40 animate-fade-in" tabindex="-1" aria-hidden="true" (click)="launcher.close()"></div>
    }
    <section
      id="assistant-panel"
      class="assistant-panel fixed inset-y-0 end-0 z-40 flex w-full flex-col border-s border-line bg-canvas shadow-lg sm:w-[26rem]"
      [class.assistant-docked]="!overlay()"
      [class.is-opening]="opening()"
      [hidden]="!launcher.isOpen()"
      [attr.role]="overlay() ? 'dialog' : 'region'"
      [attr.aria-modal]="overlay() ? 'true' : null"
      aria-labelledby="assistant-title"
      [cdkTrapFocus]="overlay() && launcher.isOpen()"
      tabindex="-1"
      (keydown.escape)="launcher.close()"
      data-testid="assistant-panel"
    >
      <header class="flex h-[var(--topbar-height)] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg" aria-hidden="true">
          <svg lucideIcon="bot" [size]="17"></svg>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="assistant-title" class="truncate text-sm font-semibold text-fg">{{ 'assistant.title' | translate }}</h2>
          <p class="truncate text-2xs text-fg-muted" data-testid="assistant-label">{{ 'assistant.subtitle' | translate }}</p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          [disabled]="store.isEmpty() && store.runs().length === 0"
          [attr.aria-label]="'assistant.reset' | translate"
          [title]="'assistant.reset' | translate"
          (click)="reset()"
          data-testid="assistant-reset"
        >
          <svg lucideIcon="eraser" [size]="16" aria-hidden="true"></svg>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          [attr.aria-label]="'assistant.close' | translate"
          (click)="launcher.close()"
          data-testid="assistant-close"
        >
          <svg lucideIcon="x" [size]="17" aria-hidden="true"></svg>
        </button>
      </header>

      <ui-tabs
        class="shrink-0 bg-surface px-2"
        idPrefix="assistant"
        [tabs]="tabs()"
        [(active)]="tab"
        [label]="'assistant.title' | translate"
      />

      <div
        #scroller
        id="assistant-panel-body"
        role="tabpanel"
        [attr.aria-labelledby]="'assistant-tab-' + tab()"
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        (scroll)="onScroll()"
        [attr.aria-live]="tab() === 'chat' ? 'polite' : null"
        aria-relevant="additions"
      >
        @if (tab() === 'chat') {
          <app-assistant-conversation (suggest)="suggest($event)" />
        } @else {
          <app-event-inspector />
        }
      </div>

      @if (tab() === 'chat') {
        <footer class="shrink-0 border-t border-line bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <app-assistant-composer #composer [running]="store.running()" (send)="send($event)" (stop)="session.stop()" />
        </footer>
      }
    </section>
  `,
  styles: `
    :host {
      display: contents;
    }
    .assistant-panel.is-opening {
      animation: slide-in-end 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host-context([dir='rtl']) .assistant-panel.is-opening {
      animation-name: slide-in-start;
    }
    @media (min-width: 1440px) {
      .assistant-docked {
        width: var(--assistant-width);
        z-index: 25;
      }
    }
  `,
  host: { '(document:keydown.escape)': 'onDocumentEscape($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantPanel {
  protected readonly launcher = inject(AssistantLauncher);
  protected readonly session = inject(AssistantSession);
  protected readonly store = inject(AssistantStore);
  private readonly language = inject(LanguageService);
  private readonly viewport = inject(ViewportService);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<AssistantComposer>('composer');

  /** Docked beside the page on wide screens (≥ 1440px); a modal drawer otherwise. */
  protected readonly overlay = computed(() => !this.viewport.canDockPanel());
  protected readonly tab = signal<'chat' | 'events'>('chat');
  /** Slide-in plays when the panel opens, not when the text direction changes. */
  protected readonly opening = signal(false);
  protected readonly tabs = computed(() => [
    { id: 'chat', label: this.language.t('assistant.tabs.chat') },
    { id: 'events', label: this.language.t('assistant.tabs.events'), count: this.store.eventCount() },
  ]);

  constructor() {
    // Move focus into the panel when it opens.
    effect(() => {
      if (!this.launcher.isOpen()) return;
      untracked(() => {
        this.opening.set(true);
        setTimeout(() => this.opening.set(false), 300);
        setTimeout(() => this.composer()?.focus(), 0);
      });
    });

    // Follow new content unless the visitor scrolled up to read something.
    afterRenderEffect(() => {
      this.store.messages();
      this.store.running();
      this.store.rejected();
      const el = this.scroller()?.nativeElement;
      if (el && this.tab() === 'chat' && this.followBottom) el.scrollTop = el.scrollHeight;
    });
  }

  /** True while the conversation is scrolled to (or near) the bottom. */
  private followBottom = true;

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (el) this.followBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  protected send(text: string): void {
    this.followBottom = true;
    void this.session.send(text);
  }

  protected suggest(suggestion: Suggestion): void {
    this.followBottom = true;
    void this.session.send(this.language.t(suggestion.key), suggestion.command);
    // The chips hide while the run streams; keep focus inside the panel.
    setTimeout(() => this.composer()?.focus(), 0);
  }

  /**
   * As a modal drawer, Escape closes the panel even when focus was lost (e.g. a
   * clicked chip was removed). Events already handled by a dialog, menu or
   * combobox are ignored. Docked, Escape only applies inside the panel.
   */
  protected onDocumentEscape(event: Event): void {
    if (this.overlay() && this.launcher.isOpen() && !event.defaultPrevented) this.launcher.close();
  }

  protected reset(): void {
    this.session.reset();
    this.tab.set('chat');
    setTimeout(() => this.composer()?.focus(), 0);
  }
}
