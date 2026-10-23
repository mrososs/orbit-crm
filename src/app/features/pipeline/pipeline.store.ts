import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Deal, DEAL_STAGES, DealStage, isOpenStage, Priority, PRIORITY_WEIGHT } from '../../core/models';
import { PipelineView, PreferencesService } from '../../core/services/preferences.service';
import { matchesQuery } from '../../shared/utils/text';
import { CompaniesStore, DealsStore } from '../../state/entity-stores';

export type PipelineSort = 'updated' | 'value' | 'closeDate' | 'priority';
export const PIPELINE_SORTS: readonly PipelineSort[] = ['updated', 'value', 'closeDate', 'priority'];

interface PipelineState {
  query: string;
  ownerId: string;
  priority: Priority | 'all';
  stage: DealStage | 'all';
  sort: PipelineSort;
  view: PipelineView;
}

export interface PipelineColumn {
  stage: DealStage;
  deals: Deal[];
  total: number;
}

const COMPARATORS: Record<PipelineSort, (a: Deal, b: Deal) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  value: (a, b) => b.value - a.value,
  closeDate: (a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate),
  priority: (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || b.value - a.value,
};

/** Pipeline view state (filters, sort, view mode) — kept across navigation. */
export const PipelineStore = signalStore(
  { providedIn: 'root' },
  withState<PipelineState>(() => ({
    query: '',
    ownerId: 'all',
    priority: 'all',
    stage: 'all',
    sort: 'updated',
    view: inject(PreferencesService).pipelineView(),
  })),
  withComputed((state) => {
    const deals = inject(DealsStore);
    const companies = inject(CompaniesStore);

    const filtered = computed(() => {
      const companyMap = companies.entityMap();
      const query = state.query();
      return deals
        .entities()
        .filter(
          (d) =>
            (state.ownerId() === 'all' || d.ownerId === state.ownerId()) &&
            (state.priority() === 'all' || d.priority === state.priority()) &&
            (state.stage() === 'all' || d.stage === state.stage()) &&
            matchesQuery(query, d.name, d.companyId ? companyMap[d.companyId]?.name : '', ...d.tags),
        )
        .sort(COMPARATORS[state.sort()]);
    });

    return {
      loading: computed(() => deals.isLoading()),
      filtered,
      columns: computed<PipelineColumn[]>(() => {
        const stages = state.stage() === 'all' ? DEAL_STAGES : [state.stage() as DealStage];
        const list = filtered();
        return stages.map((stage) => {
          const inStage = list.filter((d) => d.stage === stage);
          return { stage, deals: inStage, total: inStage.reduce((sum, d) => sum + d.value, 0) };
        });
      }),
      openSummary: computed(() => {
        const open = deals.entities().filter((d) => isOpenStage(d.stage));
        return { count: open.length, value: open.reduce((sum, d) => sum + d.value, 0) };
      }),
      hasDeals: computed(() => deals.entities().length > 0),
      activeFilters: computed(
        () =>
          [state.query() !== '', state.ownerId() !== 'all', state.priority() !== 'all', state.stage() !== 'all'].filter(
            Boolean,
          ).length,
      ),
    };
  }),
  withMethods((store) => ({
    setQuery: (query: string) => patchState(store, { query }),
    setOwner: (ownerId: string) => patchState(store, { ownerId }),
    setPriority: (priority: Priority | 'all') => patchState(store, { priority }),
    setStage: (stage: DealStage | 'all') => patchState(store, { stage }),
    setSort: (sort: PipelineSort) => patchState(store, { sort }),
    setView: (view: PipelineView) => patchState(store, { view }),
    clearFilters: () => patchState(store, { query: '', ownerId: 'all', priority: 'all', stage: 'all' }),
  })),
);
