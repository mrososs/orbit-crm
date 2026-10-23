import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { previousRange, resolveRange, toRangeInputs } from '../../core/analytics/date-range';
import {
  averageSalesCycle,
  conversionFunnel,
  historyStart,
  isComparable,
  pipelineByStage,
  relativeChange,
  revenueIn,
  revenueSeries,
  sourceInsights,
  teamPerformance,
  valueDistribution,
  winRateIn,
} from '../../core/analytics/metrics';
import { LeadSource } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { RangePreset } from '../../core/services/preferences.service';
import { RangeSelection } from '../../shared/ui/range-filter';
import { ContactsStore, DealsStore, TeamStore } from '../../state/entity-stores';

interface ReportsState {
  preset: RangePreset;
  customStart: string;
  customEnd: string;
  ownerId: string;
  source: LeadSource | 'all';
}

/** Reports view state; all analytics derive from the shared entity stores. */
export const ReportsStore = signalStore(
  { providedIn: 'root' },
  withState<ReportsState>(() => {
    const defaults = toRangeInputs(resolveRange('last90', inject(CLOCK)()));
    return { preset: 'last12m', customStart: defaults.start, customEnd: defaults.end, ownerId: 'all', source: 'all' };
  }),
  withComputed((state) => {
    const clock = inject(CLOCK);
    const dealsStore = inject(DealsStore);
    const contactsStore = inject(ContactsStore);
    const teamStore = inject(TeamStore);

    const range = computed(() =>
      resolveRange(state.preset(), clock(), { start: state.customStart(), end: state.customEnd() }),
    );
    const previous = computed(() => previousRange(range()));
    const deals = computed(() =>
      dealsStore
        .entities()
        .filter(
          (d) =>
            (state.ownerId() === 'all' || d.ownerId === state.ownerId()) &&
            (state.source() === 'all' || d.source === state.source()),
        ),
    );
    const contacts = computed(() =>
      contactsStore
        .entities()
        .filter(
          (c) =>
            (state.ownerId() === 'all' || c.ownerId === state.ownerId()) &&
            (state.source() === 'all' || c.source === state.source()),
        ),
    );

    return {
      loading: computed(() => dealsStore.isLoading() || contactsStore.isLoading() || teamStore.isLoading()),
      selection: computed<RangeSelection>(() => ({ preset: state.preset(), start: state.customStart(), end: state.customEnd() })),
      range,
      previous,
      summary: computed(() => {
        const comparable = isComparable(range(), historyStart(dealsStore.entities()));
        const ifComparable = <T>(value: T): T | null => (comparable ? value : null);
        const revenue = revenueIn(deals(), range());
        const revenuePrev = revenueIn(deals(), previous());
        const win = winRateIn(deals(), range());
        const winPrev = winRateIn(deals(), previous());
        const cycle = averageSalesCycle(deals(), range());
        const cyclePrev = averageSalesCycle(deals(), previous());
        return {
          revenue,
          revenueChange: ifComparable(relativeChange(revenue, revenuePrev)),
          won: win.won,
          lost: win.lost,
          wonChange: ifComparable(relativeChange(win.won, winPrev.won)),
          winRate: win.rate,
          winRateChange: ifComparable(win.rate !== null && winPrev.rate !== null ? win.rate - winPrev.rate : null),
          cycle,
          cycleChange: ifComparable(cycle !== null && cyclePrev !== null ? relativeChange(cycle, cyclePrev) : null),
        };
      }),
      revenue: computed(() => {
        const points = revenueSeries(deals(), range(), 'month');
        return isComparable(range(), historyStart(dealsStore.entities())) ? points : points.map((p) => ({ ...p, previous: 0 }));
      }),
      pipeline: computed(() => pipelineByStage(deals())),
      funnel: computed(() => conversionFunnel(deals(), range())),
      distribution: computed(() => valueDistribution(deals(), range())),
      sources: computed(() => sourceInsights(contacts(), deals(), range())),
      team: computed(() => {
        const members = teamStore.entities().filter((m) => state.ownerId() === 'all' || m.id === state.ownerId());
        return teamPerformance(deals(), members, range());
      }),
    };
  }),
  withMethods((store) => ({
    setRange: (s: RangeSelection) => patchState(store, { preset: s.preset, customStart: s.start, customEnd: s.end }),
    setOwner: (ownerId: string) => patchState(store, { ownerId }),
    setSource: (source: LeadSource | 'all') => patchState(store, { source }),
  })),
);
