import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { Activity, ACTIVITY_TYPES, fullName } from '../../core/models';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ActivityIcon } from '../../shared/domain/domain-badges';
import { TaskItem } from '../../shared/domain/task-item';
import { Timeline } from '../../shared/domain/timeline';
import { NumberPipe, PercentPipe } from '../../shared/pipes/locale-pipes';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { TabItem, Tabs } from '../../shared/ui/tabs';
import { debounced } from '../../shared/utils/signals';
import { LanguageService } from '../../core/i18n/language.service';
import { TeamStore } from '../../state/entity-stores';
import { TaskDateFilter, TaskGroup, TasksViewStore, TaskStatusFilter } from './tasks-view.store';
import { Select } from '../../shared/ui/controls/select';

const COMPLETED_PAGE = 10;

@Component({
  selector: 'app-activities-page',
  imports: [Select, TranslatePipe, LucideDynamicIcon, Tabs, TaskItem, Timeline, EmptyState, Skeleton, ActivityIcon, NumberPipe, PercentPipe],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ 'activities.title' | translate }}</h1>
          <p class="page-description">{{ 'activities.subtitle' | translate }}</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="create.activity()" data-testid="new-task">
          <svg lucideIcon="plus" [size]="16" aria-hidden="true"></svg>{{ 'quickCreate.activity' | translate }}
        </button>
      </header>

      <div class="grid grid-cols-1 gap-4 page-xl:grid-cols-3">
        <section class="card min-w-0 overflow-hidden page-xl:col-span-2" aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" class="sr-only">{{ 'activities.title' | translate }}</h2>
          <ui-tabs class="px-3" idPrefix="task-status" [tabs]="tabs()" [active]="store.status()" (activeChange)="setStatus($event)" [label]="'filters.status' | translate" />

          <div class="flex flex-col gap-2 border-b border-line-subtle p-3 sm:flex-row sm:flex-wrap sm:items-center" role="search">
            <div class="relative min-w-0 flex-1 sm:max-w-64">
              <svg lucideIcon="search" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true"></svg>
              <label for="task-search" class="sr-only">{{ 'common.search' | translate }}</label>
              <input id="task-search" type="search" class="control control-sm ps-9" [placeholder]="'activities.searchPlaceholder' | translate" [value]="search()" (input)="search.set($any($event.target).value)" />
            </div>
            <div class="grid grid-cols-3 gap-2 sm:flex">
              <ui-select inputId="task-type" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-type" [ariaLabel]="'filters.type' | translate" [options]="typeOptions()" [value]="store.type()" (valueChange)="store.setType($any($event))" />
              <ui-select inputId="task-date" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-date" [ariaLabel]="'filters.date' | translate" [options]="dateOptions()" [value]="store.date()" (valueChange)="setDate($event)" />
              <ui-select inputId="task-owner" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-task-owner" [ariaLabel]="'filters.owner' | translate" [options]="ownerOptions()" [value]="store.ownerId()" (valueChange)="store.setOwner($event)" />
            </div>
            @if (store.activeFilters() > 0) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="clear()">
                <svg lucideIcon="x" [size]="14" aria-hidden="true"></svg>{{ 'common.clearFilters' | translate }}
              </button>
            }
          </div>

          <div id="task-status-panel" role="tabpanel" [attr.aria-labelledby]="'task-status-tab-' + store.status()" data-testid="task-list">
            @if (store.loading()) {
              @for (i of [1, 2, 3, 4, 5]; track i) {
                <div class="flex items-center gap-3 border-b border-line-subtle px-4 py-4">
                  <ui-skeleton class="size-5 rounded-full" />
                  <div class="flex-1"><ui-skeleton class="h-4 w-2/3" /><ui-skeleton class="mt-2 h-3 w-1/3" /></div>
                </div>
              }
            } @else {
              @for (group of store.groups(); track group.bucket) {
                <div class="border-b border-line-subtle last:border-b-0" [attr.data-group]="group.bucket">
                  <h3 class="flex items-center gap-2 bg-surface-sunken/60 px-4 py-2 text-xs font-semibold" [class]="group.bucket === 'overdue' ? 'text-danger' : 'text-fg-muted'">
                    {{ 'activities.groups.' + group.bucket | translate }}
                    <span class="rounded-full bg-surface px-1.5 text-2xs font-semibold text-fg-muted shadow-xs tabular">{{ group.items.length }}</span>
                  </h3>
                  <div class="divide-y divide-line-subtle">
                    @for (task of visible(group); track task.id) {
                      <app-task-item [activity]="task" />
                    }
                  </div>
                  @if (group.bucket === 'completed' && group.items.length > completedLimit()) {
                    <div class="px-4 py-2.5">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="completedLimit.set(completedLimit() + 20)">
                        {{ 'common.showMore' | translate: { count: group.items.length - completedLimit() } }}
                      </button>
                    </div>
                  }
                </div>
              } @empty {
                <ui-empty-state icon="circle-check-big" [heading]="'activities.empty' | translate" [description]="'activities.emptyHint' | translate">
                  <button type="button" class="btn btn-secondary" (click)="create.activity()">{{ 'quickCreate.activity' | translate }}</button>
                </ui-empty-state>
              }
            }
          </div>
        </section>

        <aside class="flex min-w-0 flex-col gap-4" [attr.aria-label]="'activities.summaryTitle' | translate">
          <section class="card p-5" aria-labelledby="summary-title">
            <h2 id="summary-title" class="card-title">{{ 'activities.summaryTitle' | translate }}</h2>
            <dl class="mt-4 grid grid-cols-3 gap-3">
              <div class="rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
                <dt class="text-2xs leading-4 font-medium text-fg-muted">{{ 'activities.dueThisWeek' | translate }}</dt>
                <dd class="mt-1 text-xl font-semibold text-fg tabular" data-testid="due-week">{{ store.summary().dueThisWeek | num }}</dd>
              </div>
              <div class="rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
                <dt class="text-2xs leading-4 font-medium text-fg-muted">{{ 'activities.completedThisWeek' | translate }}</dt>
                <dd class="mt-1 text-xl font-semibold text-success tabular" data-testid="completed-week">{{ store.summary().completedThisWeek | num }}</dd>
              </div>
              <div class="rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
                <dt class="text-2xs leading-4 font-medium text-fg-muted">{{ 'activities.overdueCount' | translate }}</dt>
                <dd class="mt-1 text-xl font-semibold tabular" [class]="store.summary().overdue > 0 ? 'text-danger' : 'text-fg'" data-testid="overdue-count">
                  {{ store.summary().overdue | num }}
                </dd>
              </div>
            </dl>
            @if (store.summary().onTimeRate !== null) {
              <div class="mt-4">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-fg-muted">{{ 'activities.completionRate' | translate }}</span>
                  <span class="font-semibold text-fg tabular">{{ store.summary().onTimeRate | pct }}</span>
                </div>
                <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div class="h-full rounded-full bg-success transition-[width] duration-500" [style.width.%]="(store.summary().onTimeRate ?? 0) * 100"></div>
                </div>
              </div>
            }
            <h3 class="mt-5 text-xs font-semibold text-fg-muted">{{ 'activities.byType' | translate }}</h3>
            <ul class="mt-2 flex flex-col gap-2">
              @for (row of store.summary().byType; track row.type) {
                <li class="flex items-center gap-2.5">
                  <app-activity-icon [type]="row.type" size="sm" />
                  <span class="min-w-0 flex-1 truncate text-[0.8125rem] text-fg">{{ 'enums.activityType.' + row.type | translate }}</span>
                  <div class="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                    <div class="h-full rounded-full bg-[var(--chart-1)]" [style.width.%]="typeShare(row.count)"></div>
                  </div>
                  <span class="w-6 text-end text-xs font-semibold text-fg tabular">{{ row.count }}</span>
                </li>
              }
            </ul>
          </section>

          <section class="card" aria-labelledby="recent-title">
            <div class="card-header">
              <h2 id="recent-title" class="card-title">{{ 'activities.timelineTitle' | translate }}</h2>
            </div>
            <div class="px-5 pb-5">
              <app-timeline [events]="store.recentlyCompleted()" [emptyText]="'activities.timelineEmpty' | translate" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesPage {
  protected readonly store = inject(TasksViewStore);
  protected readonly create = inject(QuickCreateService);
  private readonly team = inject(TeamStore);
  private readonly language = inject(LanguageService);

  protected readonly name = fullName;
  protected readonly types = ACTIVITY_TYPES;
  protected readonly dateFilters: TaskDateFilter[] = ['any', 'overdue', 'today', 'week', 'later'];
  protected readonly currentUser = CURRENT_USER_ID;
  protected readonly completedLimit = signal(COMPLETED_PAGE);

  protected readonly search = signal(this.store.query());
  private readonly debouncedSearch = debounced(this.search, 180);

  protected readonly others = computed(() => this.team.members().filter((m) => m.id !== CURRENT_USER_ID));
  protected readonly typeOptions = computed(() => [{ value: 'all', label: this.language.t('filters.allTypes') }, ...this.types.map((v) => ({ value: v, label: this.language.t(`enums.activityType.${v}`) }))]);
  protected readonly dateOptions = computed(() => [...this.dateFilters.map((v) => ({ value: v, label: this.language.t(`activities.dateFilter.${v}`) }))]);
  protected readonly ownerOptions = computed(() => [
    { value: 'all', label: this.language.t('activities.everyone') },
    { value: this.currentUser, label: this.language.t('activities.mine') },
    ...this.others().map((m) => ({ value: m.id, label: fullName(m) })),
  ]);

  protected readonly tabs = computed<TabItem[]>(() => {
    const counts = this.store.counts();
    return [
      { id: 'open', label: this.language.t('activities.status.open'), count: counts.open },
      { id: 'completed', label: this.language.t('activities.status.completed'), count: counts.completed },
      { id: 'all', label: this.language.t('activities.status.all'), count: counts.all },
    ];
  });

  constructor() {
    effect(() => this.store.setQuery(this.debouncedSearch()));
  }

  protected visible(group: TaskGroup): Activity[] {
    return group.bucket === 'completed' ? group.items.slice(0, this.completedLimit()) : group.items;
  }

  protected typeShare(count: number): number {
    const max = Math.max(1, ...this.store.summary().byType.map((r) => r.count));
    return (count / max) * 100;
  }

  protected setStatus(status: string): void {
    this.store.setStatus(status as TaskStatusFilter);
    this.completedLimit.set(COMPLETED_PAGE);
  }

  protected setDate(value: string): void {
    this.store.setDate(value as TaskDateFilter);
  }

  protected clear(): void {
    this.search.set('');
    this.store.clearFilters();
  }
}
