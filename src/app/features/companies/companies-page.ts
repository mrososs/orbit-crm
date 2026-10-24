import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { Company, COMPANY_SIZES, CompanySize, fullName, Industry, INDUSTRIES } from '../../core/models';
import { PreferencesService } from '../../core/services/preferences.service';
import { ViewportService } from '../../core/services/viewport.service';
import { OwnerChip } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';
import { MoneyPipe, NumberPipe, RegionPipe } from '../../shared/pipes/locale-pipes';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { Paginator } from '../../shared/ui/paginator';
import { Skeleton } from '../../shared/ui/skeleton';
import { ariaSort, SortHeader, SortState } from '../../shared/ui/sort-header';
import { debounced } from '../../shared/utils/signals';
import { websiteHost } from '../../shared/utils/text';
import { CompaniesStore, TeamStore } from '../../state/entity-stores';
import { CompaniesViewStore } from './companies-view.store';
import { Select } from '../../shared/ui/controls/select';

@Component({
  selector: 'app-companies-page',
  imports: [Select, 
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    CdkMenuTrigger,
    CdkMenu,
    CdkMenuItem,
    Avatar,
    OwnerChip,
    EmptyState,
    Paginator,
    Skeleton,
    SortHeader,
    MoneyPipe,
    NumberPipe,
    PluralPipe,
    RegionPipe,
  ],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ 'companies.title' | translate }}</h1>
          <p class="page-description">
            {{ 'companies.subtitle' | plural: companyCount() : { value: (store.lifetimeRevenue() | money) } }}
          </p>
        </div>
        <button type="button" class="btn btn-primary" (click)="create.company()" data-testid="new-company">
          <svg lucideIcon="building" [size]="16" aria-hidden="true"></svg>{{ 'quickCreate.company' | translate }}
        </button>
      </header>

      <section class="card overflow-hidden" aria-labelledby="companies-heading">
        <h2 id="companies-heading" class="sr-only">{{ 'companies.title' | translate }}</h2>
        <div class="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center" role="search">
          <div class="relative min-w-0 flex-1 lg:max-w-sm">
            <svg lucideIcon="search" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true"></svg>
            <label for="company-search" class="sr-only">{{ 'common.search' | translate }}</label>
            <input id="company-search" type="search" class="control control-sm ps-9" [placeholder]="'companies.searchPlaceholder' | translate" [value]="search()" (input)="search.set($any($event.target).value)" data-testid="company-search" />
          </div>
          <div class="grid grid-cols-3 gap-2 sm:flex">
            <ui-select inputId="company-industry" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-industry" [ariaLabel]="'filters.industry' | translate" [options]="industryOptions()" [value]="store.industry()" (valueChange)="setIndustry($event)" />
            <ui-select inputId="company-size" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-size" [ariaLabel]="'filters.size' | translate" [options]="sizeOptions()" [value]="store.size()" (valueChange)="setSize($event)" />
            <ui-select inputId="company-owner" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-company-owner" [ariaLabel]="'filters.owner' | translate" [options]="ownerOptions()" [value]="store.ownerId()" (valueChange)="store.setOwner($event)" />
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
                <ui-skeleton class="size-8 rounded-lg" /><ui-skeleton class="h-4 w-44" /><ui-skeleton class="ms-auto h-4 w-20" />
              </div>
            }
          </div>
        } @else if (store.total() === 0) {
          @if (store.hasCompanies()) {
            <ui-empty-state icon="search-x" [heading]="'companies.empty' | translate" [description]="'companies.emptyHint' | translate">
              <button type="button" class="btn btn-secondary" (click)="clear()">{{ 'common.clearFilters' | translate }}</button>
            </ui-empty-state>
          } @else {
            <ui-empty-state icon="building" [heading]="'companies.none' | translate" [description]="'companies.noneHint' | translate">
              <button type="button" class="btn btn-primary" (click)="create.company()">{{ 'quickCreate.company' | translate }}</button>
            </ui-empty-state>
          }
        } @else if (viewport.isMobile()) {
          <ul class="divide-y divide-line-subtle" data-testid="companies-list">
            @for (row of store.pageRows(); track row.company.id) {
              <li>
                <a [routerLink]="['/companies', row.company.id]" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                  <ui-avatar [name]="row.company.name" size="lg" [square]="true" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-fg">{{ row.company.name }}</p>
                    <p class="truncate text-xs text-fg-muted">{{ 'enums.industry.' + row.company.industry | translate }} · {{ row.company.city }}</p>
                  </div>
                  <div class="text-end">
                    <p class="text-sm font-semibold text-fg tabular">{{ row.wonRevenue | money: 'compact' }}</p>
                    <p class="text-2xs text-fg-subtle">{{ 'companies.columns.wonRevenue' | translate }}</p>
                  </div>
                </a>
              </li>
            }
          </ul>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table" [class.density-compact]="compact()" data-testid="companies-table">
              <thead>
                <tr>
                  <th scope="col" [attr.aria-sort]="sortAria('name')">
                    <ui-sort-header key="name" [label]="'companies.columns.name' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="hidden lg:table-cell">{{ 'companies.columns.industry' | translate }}</th>
                  <th scope="col" class="hidden page-2xl:table-cell" [attr.aria-sort]="sortAria('size')">
                    <ui-sort-header key="size" [label]="'companies.columns.size' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="hidden page-xl:table-cell">{{ 'companies.columns.location' | translate }}</th>
                  <th scope="col" class="text-end" [attr.aria-sort]="sortAria('contacts')">
                    <ui-sort-header key="contacts" defaultDirection="desc" [label]="'companies.columns.contacts' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="text-end" [attr.aria-sort]="sortAria('openPipeline')">
                    <ui-sort-header key="openPipeline" defaultDirection="desc" [label]="'companies.columns.openPipeline' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="text-end" [attr.aria-sort]="sortAria('wonRevenue')">
                    <ui-sort-header key="wonRevenue" defaultDirection="desc" [label]="'companies.columns.wonRevenue' | translate" [sort]="store.sort()" (sortChange)="setSort($event)" />
                  </th>
                  <th scope="col" class="hidden lg:table-cell">{{ 'companies.columns.owner' | translate }}</th>
                  <th scope="col"><span class="sr-only">{{ 'common.actions' | translate }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.pageRows(); track row.company.id) {
                  <tr class="is-clickable" (click)="open(row.company)" data-testid="company-row">
                    <td class="max-w-72">
                      <div class="flex items-center gap-3">
                        <ui-avatar [name]="row.company.name" size="md" [square]="true" />
                        <div class="min-w-0">
                          <a [routerLink]="['/companies', row.company.id]" class="block truncate font-medium text-fg hover:text-primary" (click)="$event.stopPropagation()">{{ row.company.name }}</a>
                          <p class="ltr-content truncate text-xs text-fg-muted">{{ host(row.company.website) }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="hidden text-fg-muted lg:table-cell">{{ 'enums.industry.' + row.company.industry | translate }}</td>
                    <td class="hidden whitespace-nowrap text-fg-muted page-2xl:table-cell">{{ 'enums.companySize.' + row.company.size | translate }}</td>
                    <td class="hidden max-w-48 truncate text-fg-muted page-xl:table-cell">{{ row.company.city }}, {{ row.company.countryCode | region }}</td>
                    <td class="text-end text-fg tabular">{{ row.contacts | num }}</td>
                    <td class="text-end text-fg tabular">{{ row.openPipeline | money }}</td>
                    <td class="text-end font-semibold text-fg tabular">{{ row.wonRevenue | money }}</td>
                    <td class="hidden lg:table-cell"><app-owner [ownerId]="row.company.ownerId" [showName]="false" /></td>
                    <td class="w-12 text-end" (click)="$event.stopPropagation()">
                      <button type="button" class="btn btn-ghost btn-icon btn-sm" [cdkMenuTriggerFor]="menu" [attr.aria-label]="'common.rowActions' | translate: { name: row.company.name }">
                        <svg lucideIcon="ellipsis" aria-hidden="true"></svg>
                      </button>
                      <ng-template #menu>
                        <div cdkMenu class="menu-panel">
                          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="open(row.company)">
                            <svg lucideIcon="arrow-up-right" class="rtl-flip text-fg-muted" aria-hidden="true"></svg>{{ 'common.view' | translate }}
                          </button>
                          <button cdkMenuItem class="menu-item" (cdkMenuItemTriggered)="actions.editCompany(row.company)">
                            <svg lucideIcon="pencil" class="text-fg-muted" aria-hidden="true"></svg>{{ 'common.edit' | translate }}
                          </button>
                          <div class="menu-separator" role="separator"></div>
                          <button cdkMenuItem class="menu-item is-danger" (cdkMenuItemTriggered)="actions.deleteCompany(row.company)">
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
export class CompaniesPage {
  protected readonly store = inject(CompaniesViewStore);
  protected readonly team = inject(TeamStore);
  private readonly language = inject(LanguageService);
  protected readonly create = inject(QuickCreateService);
  protected readonly actions = inject(RecordActions);
  protected readonly viewport = inject(ViewportService);
  private readonly companies = inject(CompaniesStore);
  private readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  protected readonly name = fullName;
  protected readonly host = websiteHost;
  protected readonly industries = INDUSTRIES;
  protected readonly sizes = COMPANY_SIZES;
  protected readonly industryOptions = computed(() => [{ value: 'all', label: this.language.t('filters.allIndustries') }, ...this.industries.map((v) => ({ value: v, label: this.language.t(`enums.industry.${v}`) }))]);
  protected readonly sizeOptions = computed(() => [{ value: 'all', label: this.language.t('filters.allSizes') }, ...this.sizes.map((v) => ({ value: v, label: this.language.t(`enums.companySize.${v}`) }))]);
  protected readonly ownerOptions = computed(() => [
    { value: 'all', label: this.language.t('filters.allOwners') },
    ...this.team.members().map((m) => ({ value: m.id, label: fullName(m) })),
  ]);
  protected readonly compact = computed(() => this.prefs.density() === 'compact');
  protected readonly companyCount = computed(() => this.companies.entities().length);

  protected readonly search = signal(this.store.query());
  private readonly debouncedSearch = debounced(this.search, 200);

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

  protected setIndustry(value: string): void {
    this.store.setIndustry(value as Industry | 'all');
  }

  protected setSize(value: string): void {
    this.store.setSize(value as CompanySize | 'all');
  }

  protected open(company: Company): void {
    void this.router.navigate(['/companies', company.id]);
  }

  protected clear(): void {
    this.search.set('');
    this.store.clearFilters();
  }
}
