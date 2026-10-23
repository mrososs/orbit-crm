import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { ActivityBucket, activityBucket } from '../../core/domain/activity-rules';
import { Activity, ACTIVITY_TYPES, ActivityType, fullName } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { addDays, startOfDay } from '../../shared/utils/date';
import { matchesQuery } from '../../shared/utils/text';
import { ActivitiesStore, ContactsStore, DealsStore, TimelineStore } from '../../state/entity-stores';

export type TaskStatusFilter = 'open' | 'completed' | 'all';
export type TaskDateFilter = 'any' | 'overdue' | 'today' | 'week' | 'later';

interface TasksViewState {
  status: TaskStatusFilter;
  type: ActivityType | 'all';
  date: TaskDateFilter;
  ownerId: string;
  query: string;
}

export interface TaskGroup {
  bucket: ActivityBucket;
  items: Activity[];
}

const GROUP_ORDER: ActivityBucket[] = ['overdue', 'today', 'upcoming', 'later', 'completed'];

/** Tasks workspace view state and derived groupings. */
export const TasksViewStore = signalStore(
  { providedIn: 'root' },
  withState<TasksViewState>({ status: 'open', type: 'all', date: 'any', ownerId: 'all', query: '' }),
  withComputed((state) => {
    const clock = inject(CLOCK);
    const activities = inject(ActivitiesStore);
    const contacts = inject(ContactsStore);
    const deals = inject(DealsStore);
    const timeline = inject(TimelineStore);

    const dateMatches = (a: Activity, bucket: ActivityBucket): boolean => {
      switch (state.date()) {
        case 'any':
          return true;
        case 'overdue':
          return bucket === 'overdue';
        case 'today':
          return bucket === 'today';
        case 'week':
          return bucket === 'today' || bucket === 'upcoming';
        case 'later':
          return bucket === 'later';
      }
    };

    const filtered = computed(() => {
      const now = clock();
      const contactMap = contacts.entityMap();
      const dealMap = deals.entityMap();
      return activities.entities().filter((a) => {
        const bucket = activityBucket(a, now);
        const done = a.completedAt !== null;
        const contact = a.contactId ? contactMap[a.contactId] : undefined;
        return (
          (state.status() === 'all' || (state.status() === 'open' ? !done : done)) &&
          (state.type() === 'all' || a.type === state.type()) &&
          (state.ownerId() === 'all' || a.ownerId === state.ownerId()) &&
          (done || dateMatches(a, bucket)) &&
          matchesQuery(
            state.query(),
            a.subject,
            a.description,
            contact ? fullName(contact) : '',
            a.dealId ? dealMap[a.dealId]?.name : '',
          )
        );
      });
    });

    return {
      loading: computed(() => activities.isLoading()),
      filtered,
      groups: computed<TaskGroup[]>(() => {
        const now = clock();
        const map = new Map<ActivityBucket, Activity[]>(GROUP_ORDER.map((b) => [b, []]));
        for (const a of filtered()) map.get(activityBucket(a, now))!.push(a);
        return GROUP_ORDER.map((bucket) => ({
          bucket,
          items: map
            .get(bucket)!
            .sort((a, b) =>
              bucket === 'completed' ? b.completedAt!.localeCompare(a.completedAt!) : a.dueAt.localeCompare(b.dueAt),
            ),
        })).filter((g) => g.items.length > 0);
      }),
      counts: computed(() => {
        const all = activities.entities();
        const owned = state.ownerId() === 'all' ? all : all.filter((a) => a.ownerId === state.ownerId());
        const open = owned.filter((a) => a.completedAt === null);
        return { open: open.length, completed: owned.length - open.length, all: owned.length };
      }),
      summary: computed(() => {
        const now = clock();
        const today = startOfDay(now);
        const weekAhead = addDays(today, 8);
        const weekAgo = addDays(today, -7);
        const all = activities.entities().filter((a) => state.ownerId() === 'all' || a.ownerId === state.ownerId());
        const open = all.filter((a) => a.completedAt === null);
        const completedRecently = all.filter((a) => a.completedAt && new Date(a.completedAt) >= weekAgo);
        const onTime = completedRecently.filter((a) => new Date(a.completedAt!) <= addDays(startOfDay(new Date(a.dueAt)), 1));
        return {
          dueThisWeek: open.filter((a) => new Date(a.dueAt) >= today && new Date(a.dueAt) < weekAhead).length,
          completedThisWeek: completedRecently.length,
          overdue: open.filter((a) => activityBucket(a, now) === 'overdue').length,
          onTimeRate: completedRecently.length ? onTime.length / completedRecently.length : null,
          byType: ACTIVITY_TYPES.map((type) => ({ type, count: open.filter((a) => a.type === type).length })),
        };
      }),
      recentlyCompleted: computed(() =>
        timeline
          .recent()
          .filter((e) => e.kind === 'activity-completed')
          .slice(0, 6),
      ),
      activeFilters: computed(
        () => [state.type() !== 'all', state.date() !== 'any', state.ownerId() !== 'all', state.query() !== ''].filter(Boolean).length,
      ),
    };
  }),
  withMethods((store) => ({
    setStatus: (status: TaskStatusFilter) => patchState(store, { status }),
    setType: (type: ActivityType | 'all') => patchState(store, { type }),
    setDate: (date: TaskDateFilter) => patchState(store, { date }),
    setOwner: (ownerId: string) => patchState(store, { ownerId }),
    setQuery: (query: string) => patchState(store, { query }),
    clearFilters: () => patchState(store, { type: 'all', date: 'any', ownerId: 'all', query: '' }),
  })),
);
