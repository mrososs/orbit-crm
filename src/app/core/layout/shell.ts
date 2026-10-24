import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, ViewContainerRef } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Toaster } from '../../shared/ui/toaster';
import { ToastService } from '../services/toast.service';
import { ViewportService } from '../services/viewport.service';
import { WorkspaceService } from '../../state/workspace.service';
import { AssistantLauncher } from './assistant-launcher.service';
import { CommandPaletteService } from './command-palette.service';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar, Toaster, A11yModule, LucideDynamicIcon, TranslatePipe],
  template: `
    <a
      href="#main"
      class="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      (click)="focusMain($event)"
      >{{ 'nav.skipToContent' | translate }}</a
    >

    <aside
      class="fixed inset-y-0 start-0 z-30 hidden w-[var(--sidebar-width)] border-e border-line bg-surface lg:flex"
      [attr.aria-label]="'nav.sidebar' | translate"
    >
      <app-sidebar />
    </aside>

    @if (mobileNavOpen()) {
      <div class="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" [attr.aria-label]="'nav.sidebar' | translate">
        <div
          class="ui-backdrop absolute inset-0 animate-fade-in"
          tabindex="-1"
          (click)="mobileNavOpen.set(false)"
          (keydown.escape)="mobileNavOpen.set(false)"
          aria-hidden="true"
        ></div>
        <div
          class="drawer-start absolute inset-y-0 start-0 flex w-[min(18rem,86vw)] bg-surface shadow-lg"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          tabindex="-1"
          (keydown.escape)="mobileNavOpen.set(false)"
          data-testid="mobile-nav"
        >
          <app-sidebar (navigate)="mobileNavOpen.set(false)" />
          <button
            type="button"
            class="btn btn-ghost btn-icon btn-sm absolute end-2 top-3"
            (click)="mobileNavOpen.set(false)"
            [attr.aria-label]="'nav.closeMenu' | translate"
          >
            <svg lucideIcon="x" [size]="18" aria-hidden="true"></svg>
          </button>
        </div>
      </div>
    }

    <div class="flex min-h-dvh min-w-0 flex-col lg:ps-[var(--sidebar-width)]" [style.padding-inline-end]="assistantDocked() ? 'var(--assistant-width)' : null">
      <app-topbar (menu)="mobileNavOpen.set(true)" />
      <main id="main" tabindex="-1" class="min-w-0 flex-1 outline-none">
        @switch (workspace.status()) {
          @case ('error') {
            <div class="page flex flex-col items-center justify-center py-24 text-center" role="alert">
              <svg lucideIcon="circle-alert" [size]="28" class="text-danger" aria-hidden="true"></svg>
              <p class="mt-4 text-base font-semibold text-fg">{{ 'errors.workspaceTitle' | translate }}</p>
              <p class="mt-1 max-w-md text-sm text-fg-muted">{{ 'errors.workspaceMessage' | translate }}</p>
              <button type="button" class="btn btn-primary mt-5" (click)="retry()">{{ 'common.retry' | translate }}</button>
            </div>
          }
          @default {
            <router-outlet />
          }
        }
      </main>
    </div>

    <ui-toaster />

    <!-- The assistant (AG-UI, A2UI, Zod and the demo agent) is imported on first open. -->
    <ng-container #assistantHost />
    @if (assistantLoading()) {
      <div
        class="fixed inset-y-0 end-0 z-40 flex w-full flex-col items-center justify-center gap-3 border-s border-line bg-surface text-sm text-fg-muted shadow-lg sm:w-[26rem]"
        role="status"
      >
        <svg lucideIcon="loader-circle" [size]="22" class="motion-safe:animate-spin text-primary" aria-hidden="true"></svg>
        {{ 'assistant.loading' | translate }}
      </div>
    }
  `,
  styles: `
    .drawer-start {
      animation: slide-in-start 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host-context([dir='rtl']) .drawer-start {
      animation-name: slide-in-end;
    }
  `,
  host: {
    class: 'block',
    '(document:keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly palette = inject(CommandPaletteService);
  protected readonly workspace = inject(WorkspaceService);
  protected readonly viewport = inject(ViewportService);
  protected readonly mobileNavOpen = signal(false);
  protected readonly assistant = inject(AssistantLauncher);
  /** On wide screens the open assistant docks beside the page instead of covering it. */
  protected readonly assistantDocked = computed(() => this.assistant.isOpen() && this.viewport.canDockPanel());
  protected readonly assistantLoading = signal(false);
  private readonly assistantHost = viewChild.required('assistantHost', { read: ViewContainerRef });

  private readonly navigationEnd = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)));

  constructor() {
    // Close the mobile drawer on navigation and when growing to desktop.
    effect(() => {
      this.navigationEnd();
      if (this.viewport.isDesktop()) this.mobileNavOpen.set(false);
    });

    // Import the assistant panel the first time it opens; it then stays mounted.
    effect(() => {
      if (!this.assistant.loaded()) return;
      untracked(() => void this.loadAssistant());
    });

    // Tell the visitor when stored data had to be repaired or restored.
    effect(() => {
      const info = this.workspace.info();
      if (info?.outcome === 'recovered') this.toast.show({ tone: 'warning', title: 'demo.recovered', duration: 7000 });
      if (info?.outcome === 'repaired') this.toast.show({ tone: 'info', title: 'demo.repaired', duration: 7000 });
    });
  }

  private async loadAssistant(): Promise<void> {
    if (this.assistantHost().length > 0 || this.assistantLoading()) return;
    this.assistantLoading.set(true);
    try {
      const { AssistantPanel } = await import('../../features/assistant/assistant-panel');
      this.assistantHost().createComponent(AssistantPanel);
    } catch (error) {
      console.error('[Orbit CRM] The demo assistant failed to load', error);
      this.assistant.close();
    } finally {
      this.assistantLoading.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void this.palette.open();
    }
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

  protected retry(): void {
    this.workspace.retry().catch(() => undefined);
  }
}
