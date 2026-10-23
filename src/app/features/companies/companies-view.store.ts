import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Company, CompanySize, COMPANY_SIZES, Industry, isOpenStage } from '../../core/models';
import { SortState } from '../../shared/ui/sort-header';
import { matchesQuery } from '../../shared/utils/text';
import { CompaniesStore, ContactsStore, DealsStore } from '../../state/entity-stores';

export type CompanySortKey = 'name' | 'size' | 'contacts' | 'openPipeline' | 'wonRevenue';

export interface CompanyRow {
  company: Company;
  contacts: number;
  openDeals: number;
  openPipeline: number;
  wonRevenue: number;
}

interface CompaniesViewState {
  query: string;
  industry: Industry | 'all';
  size: CompanySize | 'all';
  ownerId: string;
  sort: SortState<CompanySortKey>;
  page: number;
  pageSize: number;
}

/** Company directory view state with per-account rollups derived from deals and contacts. */
export const CompaniesViewStore = signalStore(
  { providedIn: 'root' },
  withState<CompaniesViewState>({
    query: '',
    industry: 'all',
    size: 'all',
    ownerId: 'all',
    sort: { key: 'wonRevenue', direction: 'desc' },
    page: 0,
    pageSize: 10,
  }),
  withComputed((state) => {
    const companies = inject(CompaniesStore);
    const contacts = inject(ContactsStore);
    const deals = inject(DealsStore);

    const rows = computed<CompanyRow[]>(() => {
      const byCompanyContacts = contacts.byCompany();
      const byCompanyDeals = deals.byCompany();
      return companies.entities().map((company) => {
        const companyDeals = byCompanyDeals.get(company.id) ?? [];
        const open = companyDeals.filter((d) => isOpenStage(d.stage));
        return {
          company,
          contacts: byCompanyContacts.get(company.id)?.length ?? 0,
          openDeals: open.length,
          openPipeline: open.reduce((sum, d) => sum + d.value, 0),
          wonRevenue: companyDeals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + d.value, 0),
        };
      });
    });

    const filtered = computed(() => {
      const { key, direction } = state.sort();
      const dir = direction === 'asc' ? 1 : -1;
      const compare: Record<CompanySortKey, (a: CompanyRow, b: CompanyRow) => number> = {
        name: (a, b) => a.company.name.localeCompare(b.company.name),
        size: (a, b) => COMPANY_SIZES.indexOf(a.company.size) - COMPANY_SIZES.indexOf(b.company.size),
        contacts: (a, b) => a.contacts - b.contacts,
        openPipeline: (a, b) => a.openPipeline - b.openPipeline,
        wonRevenue: (a, b) => a.wonRevenue - b.wonRevenue,
      };
      return rows()
        .filter(
          ({ company: c }) =>
            (state.industry() === 'all' || c.industry === state.industry()) &&
            (state.size() === 'all' || c.size === state.size()) &&
            (state.ownerId() === 'all' || c.ownerId === state.ownerId()) &&
            matchesQuery(state.query(), c.name, c.website, c.city),
        )
        .sort((a, b) => compare[key](a, b) * dir || a.company.name.localeCompare(b.company.name));
    });

    const pageCount = computed(() => Math.max(1, Math.ceil(filtered().length / state.pageSize())));

    return {
      loading: computed(() => companies.isLoading()),
      total: computed(() => filtered().length),
      currentPage: computed(() => Math.min(state.page(), pageCount() - 1)),
      pageRows: computed(() => {
        const page = Math.min(state.page(), pageCount() - 1);
        return filtered().slice(page * state.pageSize(), (page + 1) * state.pageSize());
      }),
      lifetimeRevenue: computed(() => rows().reduce((sum, r) => sum + r.wonRevenue, 0)),
      hasCompanies: computed(() => companies.entities().length > 0),
      activeFilters: computed(
        () =>
          [state.query() !== '', state.industry() !== 'all', state.size() !== 'all', state.ownerId() !== 'all'].filter(Boolean)
            .length,
      ),
    };
  }),
  withMethods((store) => ({
    setQuery: (query: string) => patchState(store, { query, page: 0 }),
    setIndustry: (industry: Industry | 'all') => patchState(store, { industry, page: 0 }),
    setSize: (size: CompanySize | 'all') => patchState(store, { size, page: 0 }),
    setOwner: (ownerId: string) => patchState(store, { ownerId, page: 0 }),
    setSort: (sort: SortState) => patchState(store, { sort: sort as SortState<CompanySortKey>, page: 0 }),
    setPage: (page: number) => patchState(store, { page }),
    setPageSize: (pageSize: number) => patchState(store, { pageSize, page: 0 }),
    clearFilters: () => patchState(store, { query: '', industry: 'all', size: 'all', ownerId: 'all', page: 0 }),
  })),
);
