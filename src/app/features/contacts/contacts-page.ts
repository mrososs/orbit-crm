import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { Contact, CONTACT_STATUSES, ContactStatus, fullName, LEAD_SOURCES, LeadSource } from '../../core/models';
import { PreferencesService } from '../../core/services/preferences.service';
import { ViewportService } from '../../core/services/viewport.service';
import { OwnerChip, StatusBadge } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';
import { RelativeTimePipe } from '../../shared/pipes/locale-pipes';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { Paginator } from '../../shared/ui/paginator';
import { Skeleton } from '../../shared/ui/skeleton';
import { ariaSort, SortHeader, SortState } from '../../shared/ui/sort-header';
import { debounced } from '../../shared/utils/signals';
import { CompaniesStore, ContactsStore, TeamStore } from '../../state/entity-stores';
import { ContactsViewStore } from './contacts-view.store';
import { SelectValue } from '../../shared/directives/select-value';

@Component({
  selector: 'app-contacts-page',
  imports: [SelectValue, 
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    CdkMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    Avatar,
    StatusBadge,
    OwnerChip,
    EmptyState,
    Paginator,
    Skeleton,
    SortHeader,
    PluralPipe,
    RelativeTimePipe,
  ],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ 'contacts.title' | translate }}</h1>
          <p class="page-description">
            {{ 'contacts.subtitle' | translate: { people: ('contacts.peopleCount' | plural: contactCount()), companies: ('contacts.companyCount' | plural: store.companyCount()) } }}
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="create.contact()" data-testid="new-contact">
          <svg lucideIcon="user-plus" [size]="16" aria-hidden="true"></svg>{{ 'quickCreate.contact' | translate }}
        </button>
      </header>

      <section class="card overflow-hidden" aria-labelledby="contacts-heading">
        <h2 id="contacts-heading" class="sr-only">{{ 'contacts.title' | translate }}</h2>
        <div class="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center" role="search">
          <div class="relative min-w-0 flex-1 lg:max-w-sm">
            <svg lucideIcon="search" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true"></svg>
            <label for="contact-search" class="sr-only">{{ 'common.search' | translate }}</label>
            <input
              id="contact-search"
              type="search"
              class="control control-sm ps-9"
              [placeholder]="'contacts.searchPlaceholder' | translate"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
              data-testid="contact-search"
            />
          </div>
          <div class="grid grid-cols-3 gap-2 sm:flex">
            <label class="sr-only" for="contact-status">{{ 'filters.status' | translate }}</label>
            <select id="contact-status" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.status()" (change)="setStatus($event)" data-testid="filter-status">
              <option value="all">{{ 'filters.allStatuses' | translate }}</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ 'enums.contactStatus.' + s | translate }}</option>
              }
            </select>
            <label class="sr-only" for="contact-source">{{ 'filters.source' | translate }}</label>
            <select id="contact-source" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.source()" (change)="setSource($event)" data-testid="filter-source">
              <option value="all">{{ 'filters.allSources' | translate }}</option>
              @for (s of sources; track s) {
                <option [value]="s">{{ 'enums.source.' + s | translate }}</option>
              }
            </select>
            <label class="sr-only" for="contact-owner">{{ 'filters.owner' | translate }}</label>
            <select id="contact-owner" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.ownerId()" (change)="store.setOwner($any($event.target).value)">
              <option value="all">{{ 'filters.allOwners' | translate }}</option>
              @for (m of team.members(); track m.id) {
                <option [value]="m.id">{{ name(m) }}</option>
              }
            </select>
          </div>
          @if (store.activeFilters() > 0) {
            <button type="button" class="btn btn-ghost btn-sm self-start lg:self-auto" (click)="clear()">
              <svg lucideIcon="x" [size]="14" aria-hidden="true"></svg>{{ 'common.clearFilters' | translate }}
            </button>
          }
        </div>

        @if (store.loading()) {
          <div class="divide-y divide-line-subtle">
            @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
              <div class="flex items-center gap-3 px-4 py-3">
                <ui-skeleton class="size-8 rounded-full" />
                <ui-skeleton class="h-4 w-40" />
                <ui-skeleton class="ms-auto h-4 w-24" />
              </div>
            }
          </div>
        } @else if (store.total() === 0) {
          @if (store.hasContacts()) {
            <ui-empty-state icon="search-x" [heading]="'contacts.empty' | translate" [description]="'contacts.emptyHint' | translate">
              <button type="button" class="btn btn-secondary" (click)="clear()">{{ 'common.clearFilters' | translate }}</button>
            </ui-empty-state>
          } @else {
            <ui-empty-state icon="users" [heading]="'contacts.none' | translate" [description]="'contacts.noneHint' | translate">
              <button type="button" class="btn btn-primary" (click)="create.contact()">{{ 'quickCreate.contact' | translate }}</button>
            </ui-empty-state>
          }
        } @else if (viewport.isMobile()) {
          <ul class="divide-y divide-line-subtle" data-testid="contacts-list">
            @for (row of rows(); track row.contact.id) {
              <li>
                <a [routerLink]="['/contacts', row.contact.id]" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover" data-testid="contact-row">
                  <ui-avatar [name]="row.name" size="lg" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-fg">{{ row.name }}</p>
                    <p class="truncate text-xs text-fg-muted">{{ row.contact.jobTitle }}@if (row.company) { · {{ row.company }} }</p>
                    <p class="mt-0.5 text-2xs text-fg-subtle">{{ row.contact.lastInteractionAt ? (row.contact.lastInteractionAt | relativeTime) : ('common.never' | translate) }}</p>
                  </div>
                  <app-status-badge [status]="row.contact.status" />
                </a>
              </li>
            }
          </ul>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table" [class.density-compact]="compact()" data-testid="contacts-table">
              <thead>
                <tr>
                  <th scope="col" [attr.aria-sort]="sortAria('name')">
                    <ui-sort-header key="name" [label]="'contacts.columns.name' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="hidden lg:table-cell">{{ 'contacts.columns.email' | translate }}</th>
                  <th scope="col" class="hidden 2xl:table-cell">{{ 'contacts.columns.phone' | translate }}</th>
                  <th scope="col" [attr.aria-sort]="sortAria('company')">
                    <ui-sort-header key="company" [label]="'contacts.columns.company' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" [attr.aria-sort]="sortAria('status')">
                    <ui-sort-header key="status" [label]="'contacts.columns.status' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="hidden 2xl:table-cell">{{ 'contacts.columns.source' | translate }}</th>
                  <th scope="col" class="hidden lg:table-cell">{{ 'contacts.columns.owner' | translate }}</th>
                  <th scope="col" [attr.aria-sort]="sortAria('lastInteraction')">
                    <ui-sort-header
                      key="lastInteraction"
                      defaultDirection="desc"
                      [label]="'contacts.columns.lastInteraction' | translate"
                      [sort]="store.sort()"
                      (sortChange)="setSort($event)"
                    />
                  </th>
                  <th scope="col"><span class="sr-only">{{ 'common.actions' | translate }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.contact.id) {
                  <tr class="is-clickable" (click)="open(row.contact)" data-testid="contact-row">
                    <td class="max-w-72">
                      <div class="flex items-center gap-3">
                        <ui-avatar [name]="row.name" size="md" />
                        <div class="min-w-0">
                          <a [routerLink]="['/contacts', row.contact.id]" class="block truncate font-medium text-fg hover:text-primary" (click)="$event.stopPropagation()" data-testid="contact-name">{{ row.name }}</a>
                          <p class="truncate text-xs text-fg-muted">{{ row.contact.jobTitle }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="hidden max-w-56 lg:table-cell">
                      <a class="ltr-content block truncate text-fg-muted hover:text-primary" [href]="'mailto:' + row.contact.email" (click)="$event.stopPropagation()">{{ row.contact.email }}</a>
                    </td>
                    <td class="hidden whitespace-nowrap text-fg-muted 2xl:table-cell"><span class="ltr-content">{{ row.contact.phone }}</span></td>
                    <td class="max-w-48">
                      @if (row.company) {
                        <span class="block truncate text-fg">{{ row.company }}</span>
                      } @else {
                        <span class="text-fg-subtle">—</span>
                      }
                    </td>
                    <td><app-status-badge [status]="row.contact.status" /></td>
                    <td class="hidden text-fg-muted 2xl:table-cell">{{ 'enums.source.' + row.contact.source | translate }}</td>
                    <td class="hidden lg:table-cell"><app-owner [ownerId]="row.contact.ownerId" [showName]="false" /></td>
                    <td class="whitespace-nowrap text-fg-muted">
                      {{ row.contact.lastInteractionAt ? (row.contact.lastInteractionAt | relativeTime) : ('common.never' | translate) }}
                    </td>
                    <td class="w-12 text-end" (click)="$event.stopPropagation()">
                      <button type="button" class="btn btn-ghost btn-icon btn-sm" [cdkMenuTriggerFor]="menu" [attr.aria-label]="'common.rowActions' | translate: { name: row.name }">
                        <svg lucideIcon="ellipsis" aria-hidden="true"></svg>
                      </button>
                      <ng-template #menu>
                        <div cdkMenu class="menu-panel">
                          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="open(row.contact)">
                            <svg lucideIcon="arrow-up-right" class="rtl-flip text-fg-muted" aria-hidden="true"></svg>{{ 'common.view' | translate }}
                          </button>
                          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="actions.editContact(row.contact)">
                            <svg lucideIcon="pencil" class="text-fg-muted" aria-hidden="true"></svg>{{ 'common.edit' | translate }}
                          </button>
                          <div class="menu-separator" role="separator"></div>
                          <button cdkMenuItem class="menu-item is-danger" (cdkMenuItemTriggered)="actions.deleteContact(row.contact)">
                            <svg lucideIcon="trash" aria-hidden="true"></svg>{{ 'common.delete' | translate }}
                          </button>
                        </div>
                      </ng-template>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (!store.loading() && store.total() > 0) {
          <ui-paginator
            [total]="store.total()"
            [page]="store.currentPage()"
            (pageChange)="store.setPage($event)"
            [pageSize]="store.pageSize()"
            (pageSizeChange)="store.setPageSize($event)"
          />
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  protected readonly store = inject(ContactsViewStore);
  protected readonly team = inject(TeamStore);
  protected readonly create = inject(QuickCreateService);
  protected readonly actions = inject(RecordActions);
  protected readonly viewport = inject(ViewportService);
  private readonly companies = inject(CompaniesStore);
  private readonly contactsStore = inject(ContactsStore);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  protected readonly name = fullName;
  protected readonly statuses = CONTACT_STATUSES;
  protected readonly sources = LEAD_SOURCES;
  protected readonly compact = computed(() => this.prefs.density() === 'compact');
  protected readonly contactCount = computed(() => this.contactsStore.entities().length);

  protected readonly search = signal(this.store.query());
  private readonly debouncedSearch = debounced(this.search, 200);

  protected readonly rows = computed(() => {
    const companies = this.companies.entityMap();
    return this.store.rows().map((contact) => ({
      contact,
      name: fullName(contact),
      company: contact.companyId ? (companies[contact.companyId]?.name ?? '') : '',
    }));
  });

  constructor() {
    effect(() => {
      const query = this.debouncedSearch();
      if (query !== this.store.query()) this.store.setQuery(query);
    });
  }

  protected sortAria(key: string) {
    return ariaSort(this.store.sort(), key);
  }

  protected setSort(sort: SortState): void {
    this.store.setSort(sort);
  }

  protected setStatus(event: Event): void {
    this.store.setStatus((event.target as HTMLSelectElement).value as ContactStatus | 'all');
  }

  protected setSource(event: Event): void {
    this.store.setSource((event.target as HTMLSelectElement).value as LeadSource | 'all');
  }

  protected open(contact: Contact): void {
    void this.router.navigate(['/contacts', contact.id]);
  }

  protected clear(): void {
    this.search.set('');
    this.store.clearFilters();
  }
}
