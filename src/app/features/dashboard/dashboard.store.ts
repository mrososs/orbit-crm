import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { granularityFor, previousRange, resolveRange, toRangeInputs } from '../../core/analytics/date-range';
import {
  closedByMonth,
  computeKpis,
  historyStart,
  isComparable,
  leadSources,
  pipelineByStage,
  revenueSeries,
  teamPerformance,
} from '../../core/analytics/metrics';
import { CLOCK } from '../../core/services/platform';
import { PreferencesService, RangePreset } from '../../core/services/preferences.service';
import { RangeSelection } from '../../shared/ui/range-filter';
import {
  ActivitiesStore,
  ContactsStore,
  DealsStore,
  TeamStore,
  TimelineStore,
} from '../../state/entity-stores';

interface DashboardState {
  preset: RangePreset;
  customStart: string;
  customEnd: string;
  /** Team member filter; 'all' for the whole team. */
  ownerId: string;
}

/**
 * Dashboard view state. Filters live at root level so they survive navigation
 * and language switches; every figure is derived from the entity stores.
 */
export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState<DashboardState>(() => {
    const now = inject(CLOCK)();
    const preset = inject(PreferencesService).dashboardRange();
    const defaults = toRangeInputs(resolveRange('last30', now));
    return { preset, customStart: defaults.start, customEnd: defaults.end, ownerId: 'all' };
  }),
  withComputed((state) => {
    const clock = inject(CLOCK);
    const deals = inject(DealsStore);
    const activities = inject(ActivitiesStore);
    const contacts = inject(ContactsStore);
    const team = inject(TeamStore);
    const timeline = inject(TimelineStore);

    const range = computed(() =>
      resolveRange(state.preset(), clock(), { start: state.customStart(), end: state.customEnd() }),
    );
    const owned = <T extends { ownerId: string }>(items: readonly T[]) =>
      state.ownerId() === 'all' ? [...items] : items.filter((i) => i.ownerId === state.ownerId());
    const scopedDeals = computed(() => owned(deals.entities()));
    const scopedActivities = computed(() => owned(activities.entities()));
    const scopedContacts = computed(() => owned(contacts.entities()));

    return {
      loading: computed(() => deals.isLoading() || activities.isLoading() || contacts.isLoading() || team.isLoading()),
      selection: computed<RangeSelection>(() => ({
        preset: state.preset(),
        start: state.customStart(),
        end: state.customEnd(),
      })),
      range,
      previous: computed(() => previousRange(range())),
      granularity: computed(() => granularityFor(range())),
      kpis: computed(() => computeKpis(scopedDeals(), scopedActivities(), range(), clock(), historyStart(deals.entities()))),
      revenue: computed(() => {
        const points = revenueSeries(scopedDeals(), range(), granularityFor(range()));
        // Without full history for the previous period, drop the comparison line.
        return isComparable(range(), historyStart(deals.entities())) ? points : points.map((p) => ({ ...p, previous: 0 }));
      }),
      pipeline: computed(() => pipelineByStage(scopedDeals())),
      sources: computed(() => leadSources(scopedContacts(), range())),
      monthly: computed(() => closedByMonth(scopedDeals(), range())),
      team: computed(() => {
        const ownerId = state.ownerId();
        const members = team.entities().filter((m) => ownerId === 'all' || m.id === ownerId);
        // SDRs source pipeline rather than close it — list them only when they closed revenue.
        return teamPerformance(deals.entities(), members, range()).filter(
          (r) => r.member.role !== 'sdr' || r.revenue > 0 || ownerId !== 'all',
        );
      }),
      feed: computed(() => {
        const ownerId = state.ownerId();
        const events = timeline.recent();
        return (ownerId === 'all' ? events : events.filter((e) => e.actorId === ownerId)).slice(0, 8);
      }),
    };
  }),
  withMethods((store) => ({
    setRange(selection: RangeSelection): void {
      patchState(store, { preset: selection.preset, customStart: selection.start, customEnd: selection.end });
    },
    setOwner(ownerId: string): void {
      patchState(store, { ownerId });
    },
  })),
);
