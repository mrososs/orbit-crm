import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Contact, CONTACT_STATUSES, ContactStatus, fullName, LeadSource } from '../../core/models';
import { SortState } from '../../shared/ui/sort-header';
import { matchesQuery } from '../../shared/utils/text';
import { CompaniesStore, ContactsStore } from '../../state/entity-stores';

export type ContactSortKey = 'name' | 'company' | 'status' | 'lastInteraction' | 'createdAt';

interface ContactsViewState {
  query: string;
  status: ContactStatus | 'all';
  source: LeadSource | 'all';
  ownerId: string;
  sort: SortState<ContactSortKey>;
  page: number;
  pageSize: number;
}

const INITIAL: ContactsViewState = {
  query: '',
  status: 'all',
  source: 'all',
  ownerId: 'all',
  sort: { key: 'lastInteraction', direction: 'desc' },
  page: 0,
  pageSize: 10,
};

/** Contacts directory view state: search, filters, sorting and pagination. */
export const ContactsViewStore = signalStore(
  { providedIn: 'root' },
  withState<ContactsViewState>(INITIAL),
  withComputed((state) => {
    const contacts = inject(ContactsStore);
    const companies = inject(CompaniesStore);

    const companyName = (c: Contact) => (c.companyId ? (companies.entityMap()[c.companyId]?.name ?? '') : '');

    const filtered = computed(() => {
      const { key, direction } = state.sort();
      const dir = direction === 'asc' ? 1 : -1;
      const compare: Record<ContactSortKey, (a: Contact, b: Contact) => number> = {
        name: (a, b) => fullName(a).localeCompare(fullName(b)),
        company: (a, b) => companyName(a).localeCompare(companyName(b)),
        status: (a, b) => CONTACT_STATUSES.indexOf(a.status) - CONTACT_STATUSES.indexOf(b.status),
        lastInteraction: (a, b) => (a.lastInteractionAt ?? '').localeCompare(b.lastInteractionAt ?? ''),
        createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
      };
      return contacts
        .entities()
        .filter(
          (c) =>
            (state.status() === 'all' || c.status === state.status()) &&
            (state.source() === 'all' || c.source === state.source()) &&
            (state.ownerId() === 'all' || c.ownerId === state.ownerId()) &&
            matchesQuery(state.query(), fullName(c), c.email, c.jobTitle, companyName(c)),
        )
        .sort((a, b) => compare[key](a, b) * dir || fullName(a).localeCompare(fullName(b)));
    });

    const pageCount = computed(() => Math.max(1, Math.ceil(filtered().length / state.pageSize())));

    return {
      loading: computed(() => contacts.isLoading()),
      filtered,
      total: computed(() => filtered().length),
      /** Clamped so deleting the last row of a page never shows an empty page. */
      currentPage: computed(() => Math.min(state.page(), pageCount() - 1)),
      rows: computed(() => {
        const page = Math.min(state.page(), pageCount() - 1);
        const size = state.pageSize();
        return filtered().slice(page * size, page * size + size);
      }),
      companyCount: computed(() => new Set(contacts.entities().map((c) => c.companyId).filter(Boolean)).size),
      hasContacts: computed(() => contacts.entities().length > 0),
      activeFilters: computed(
        () =>
          [state.query() !== '', state.status() !== 'all', state.source() !== 'all', state.ownerId() !== 'all'].filter(Boolean)
            .length,
      ),
    };
  }),
  withMethods((store) => ({
    setQuery: (query: string) => patchState(store, { query, page: 0 }),
    setStatus: (status: ContactStatus | 'all') => patchState(store, { status, page: 0 }),
    setSource: (source: LeadSource | 'all') => patchState(store, { source, page: 0 }),
    setOwner: (ownerId: string) => patchState(store, { ownerId, page: 0 }),
    setSort: (sort: SortState) => patchState(store, { sort: sort as SortState<ContactSortKey>, page: 0 }),
    setPage: (page: number) => patchState(store, { page }),
    setPageSize: (pageSize: number) => patchState(store, { pageSize, page: 0 }),
    clearFilters: () => patchState(store, { query: '', status: 'all', source: 'all', ownerId: 'all', page: 0 }),
  })),
);
