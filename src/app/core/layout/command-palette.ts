import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Avatar } from '../../shared/ui/avatar';
import { CompaniesStore, ContactsStore, DealsStore } from '../../state/entity-stores';
import { LanguageService } from '../i18n/language.service';
import { formatCurrency } from '../i18n/locale.utils';
import { fullName } from '../models';
import { AssistantLauncher } from './assistant-launcher.service';
import { DEMO_NAV, INSIGHT_NAV, PRIMARY_NAV, SETTINGS_NAV } from './nav-items';
import { QuickCreateService } from './quick-create.service';

interface PaletteItem {
  id: string;
  group: 'pages' | 'actions' | 'deals' | 'contacts' | 'companies';
  label: string;
  meta?: string;
  icon?: string;
  avatar?: string;
  run: () => void;
}

const MAX_PER_GROUP = 5;

@Component({
  selector: 'app-command-palette',
  imports: [LucideDynamicIcon, TranslatePipe, Avatar],
  template: `
    <div class="flex max-h-[min(36rem,calc(100dvh-4rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      <div class="flex items-center gap-3 border-b border-line-subtle px-4">
        <svg lucideIcon="search" [size]="18" class="text-fg-subtle" aria-hidden="true"></svg>
        <input
          #input
          class="h-14 flex-1 bg-transparent text-[0.9375rem] text-fg outline-none placeholder:text-fg-subtle"
          [placeholder]="'search.placeholder' | translate"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-label]="'search.label' | translate"
          autocomplete="off"
          spellcheck="false"
          data-testid="command-input"
        />
        <kbd class="kbd">Esc</kbd>
      </div>

      <div id="palette-results" role="listbox" class="overflow-y-auto p-2" [attr.aria-label]="'search.results' | translate">
        @for (group of groups(); track group.key) {
          <div role="group" [attr.aria-labelledby]="'palette-group-' + group.key" class="pb-1">
            <p [id]="'palette-group-' + group.key" class="menu-label">{{ 'search.groups.' + group.key | translate }}</p>
            @for (item of group.items; track item.id) {
              <button
                type="button"
                role="option"
                [id]="'palette-' + item.id"
                [attr.aria-selected]="item.id === activeId()"
                class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm text-fg aria-selected:bg-surface-hover"
                (mouseenter)="activate(item)"
                (click)="execute(item)"
              >
                @if (item.avatar) {
                  <ui-avatar [name]="item.avatar" size="sm" [square]="item.group === 'companies'" />
                } @else if (item.icon) {
                  <span class="flex size-6 items-center justify-center rounded-md border border-line-subtle bg-surface-sunken text-fg-muted">
                    <svg [lucideIcon]="item.icon" [size]="14" aria-hidden="true"></svg>
                  </span>
                }
                <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                @if (item.meta) {
                  <span class="shrink-0 truncate text-xs text-fg-subtle tabular">{{ item.meta }}</span>
                }
              </button>
            }
          </div>
        } @empty {
          <div class="flex flex-col items-center px-6 py-10 text-center">
            <svg lucideIcon="search-x" [size]="22" class="text-fg-subtle" aria-hidden="true"></svg>
            <p class="mt-3 text-sm font-medium text-fg">{{ 'search.noResults' | translate: { query: query() } }}</p>
          </div>
        }
      </div>

      <div class="flex items-center gap-4 border-t border-line-subtle px-4 py-2 text-xs text-fg-subtle">
        <span class="flex items-center gap-1.5"><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd>{{ 'search.navigate' | translate }}</span>
        <span class="flex items-center gap-1.5"><kbd class="kbd">↵</kbd>{{ 'search.open' | translate }}</span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPalette {
  private readonly ref = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly deals = inject(DealsStore);
  private readonly contacts = inject(ContactsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly create = inject(QuickCreateService);
  private readonly assistant = inject(AssistantLauncher);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly query = signal('');
  private readonly activeIndex = signal(0);

  private readonly items = computed<PaletteItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
    const t = (key: string) => this.language.t(key);
    const locale = this.language.locale();
    const go = (path: string) => () => this.navigate(path);

    const pages: PaletteItem[] = [...PRIMARY_NAV, ...INSIGHT_NAV, SETTINGS_NAV, ...DEMO_NAV]
      .map((n) => ({ id: `page-${n.path}`, group: 'pages' as const, label: t(n.label), icon: n.icon, run: go(n.path) }))
      .filter((p) => match(p.label));

    const actions: PaletteItem[] = [
      { id: 'new-deal', label: t('quickCreate.deal'), icon: 'briefcase', run: () => this.after(() => this.create.deal()) },
      { id: 'new-contact', label: t('quickCreate.contact'), icon: 'user-plus', run: () => this.after(() => this.create.contact()) },
      { id: 'new-company', label: t('quickCreate.company'), icon: 'building', run: () => this.after(() => this.create.company()) },
      { id: 'new-activity', label: t('quickCreate.activity'), icon: 'calendar-check', run: () => this.after(() => this.create.activity()) },
      { id: 'assistant', label: t('assistant.open'), icon: 'bot', run: () => this.after(async () => this.assistant.open()) },
    ]
      .map((a) => ({ ...a, group: 'actions' as const }))
      .filter((a) => match(a.label));

    if (!q) return [...pages, ...actions];

    const companyName = (id: string | null) => (id ? (this.companies.entityMap()[id]?.name ?? '') : '');
    const deals: PaletteItem[] = this.deals
      .entities()
      .filter((d) => match(d.name, companyName(d.companyId)))
      .slice(0, MAX_PER_GROUP)
      .map((d) => ({
        id: `deal-${d.id}`,
        group: 'deals' as const,
        label: d.name,
        meta: formatCurrency(d.value, locale),
        icon: 'briefcase',
        run: go(`/deals/${d.id}`),
      }));
    const contacts: PaletteItem[] = this.contacts
      .entities()
      .filter((c) => match(fullName(c), c.email, companyName(c.companyId)))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({
        id: `contact-${c.id}`,
        group: 'contacts' as const,
        label: fullName(c),
        meta: companyName(c.companyId),
        avatar: fullName(c),
        run: go(`/contacts/${c.id}`),
      }));
    const companies: PaletteItem[] = this.companies
      .entities()
      .filter((c) => match(c.name, c.website, c.city))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({
        id: `company-${c.id}`,
        group: 'companies' as const,
        label: c.name,
        meta: c.city,
        avatar: c.name,
        run: go(`/companies/${c.id}`),
      }));

    return [...deals, ...contacts, ...companies, ...pages, ...actions];
  });

  protected readonly groups = computed(() => {
    const order: PaletteItem['group'][] = ['deals', 'contacts', 'companies', 'pages', 'actions'];
    return order
      .map((key) => ({ key, items: this.items().filter((i) => i.group === key) }))
      .filter((g) => g.items.length > 0);
  });

  protected readonly activeId = computed(() => {
    const item = this.items()[this.activeIndex()];
    return item ? `palette-${item.id}` : null;
  });

  constructor() {
    queueMicrotask(() => this.input().nativeElement.focus());
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Visual order follows group order, so navigate over the grouped list.
    const flat = this.groups().flatMap((g) => g.items);
    if (flat.length === 0) return;
    const current = flat.findIndex((i) => `palette-${i.id}` === this.activeId());
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
      this.activate(flat[next]);
      document.getElementById(`palette-${flat[next].id}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = flat[Math.max(0, current)];
      if (item) this.execute(item);
    }
  }

  protected activate(item: PaletteItem): void {
    this.activeIndex.set(this.items().indexOf(item));
  }

  protected execute(item: PaletteItem): void {
    item.run();
  }

  private navigate(path: string): void {
    this.ref.close();
    void this.router.navigateByUrl(path);
  }

  private after(action: () => Promise<unknown>): void {
    this.ref.close();
    void action();
  }
}
