import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { Deal, DEAL_STAGES, DealStage, fullName, Priority, PRIORITIES } from '../../core/models';
import { RecordActions } from '../../shared/domain/record-actions';
import { MoneyPipe } from '../../shared/pipes/locale-pipes';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { EmptyState } from '../../shared/ui/empty-state';
import { debounced } from '../../shared/utils/signals';
import { TeamStore } from '../../state/entity-stores';
import { PipelineBoard } from './pipeline-board';
import { PipelineList } from './pipeline-list';
import { PIPELINE_SORTS, PipelineSort, PipelineStore } from './pipeline.store';
import { Select } from '../../shared/ui/controls/select';

@Component({
  selector: 'app-pipeline-page',
  imports: [Select, TranslatePipe, PluralPipe, LucideDynamicIcon, PipelineBoard, PipelineList, EmptyState, MoneyPipe],
  template: `
    <div class="page animate-rise-in">
      <header class="page-header">
        <div class="min-w-0">
          <h1 class="page-title">{{ 'pipeline.title' | translate }}</h1>
          <p class="page-description" data-testid="pipeline-summary">
            {{ 'pipeline.subtitle' | plural: store.openSummary().count : { value: (store.openSummary().value | money) } }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="segmented" role="group" [attr.aria-label]="'pipeline.viewMode' | translate">
            <button type="button" [attr.aria-pressed]="store.view() === 'board'" (click)="store.setView('board')" data-testid="view-board">
              <svg lucideIcon="columns-3" [size]="14" aria-hidden="true"></svg>{{ 'pipeline.board' | translate }}
            </button>
            <button type="button" [attr.aria-pressed]="store.view() === 'list'" (click)="store.setView('list')" data-testid="view-list">
              <svg lucideIcon="list" [size]="14" aria-hidden="true"></svg>{{ 'pipeline.list' | translate }}
            </button>
          </div>
          <button type="button" class="btn btn-primary" (click)="newDeal()" data-testid="new-deal">
            <svg lucideIcon="plus" [size]="16" aria-hidden="true"></svg>{{ 'quickCreate.deal' | translate }}
          </button>
        </div>
      </header>

      <div class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center" role="search">
        <div class="relative min-w-0 flex-1 lg:max-w-xs">
          <svg lucideIcon="search" [size]="15" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true"></svg>
          <label class="sr-only" for="pipeline-search">{{ 'common.search' | translate }}</label>
          <input
            id="pipeline-search"
            type="search"
            class="control control-sm ps-9"
            [placeholder]="'pipeline.searchPlaceholder' | translate"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            data-testid="pipeline-search"
          />
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <ui-select inputId="pipeline-owner" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-owner" [ariaLabel]="'filters.owner' | translate" [options]="ownerOptions()" [value]="store.ownerId()" (valueChange)="store.setOwner($event)" />
          <ui-select inputId="pipeline-priority" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-priority" [ariaLabel]="'filters.priority' | translate" [options]="priorityOptions()" [value]="store.priority()" (valueChange)="setPriority($event)" />
          <ui-select inputId="pipeline-stage" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="filter-stage" [ariaLabel]="'filters.stage' | translate" [options]="stageOptions()" [value]="store.stage()" (valueChange)="setStage($event)" />
          <ui-select inputId="pipeline-sort" size="sm" class="sm:w-auto sm:min-w-36 sm:max-w-60" testId="pipeline-sort" [ariaLabel]="'filters.sortBy' | translate" [options]="sortOptions()" [value]="store.sort()" (valueChange)="setSort($event)" />
        </div>
        @if (store.activeFilters() > 0) {
          <button type="button" class="btn btn-ghost btn-sm self-start lg:self-auto" (click)="clear()">
            <svg lucideIcon="x" [size]="14" aria-hidden="true"></svg>
            {{ 'common.clearFilters' | translate }}
            <span class="rounded-full bg-primary-soft px-1.5 text-2xs font-semibold text-primary-soft-fg">{{ store.activeFilters() }}</span>
          </button>
        }
      </div>

      @if (!store.loading() && !store.hasDeals()) {
        <ui-empty-state class="card" icon="kanban" [heading]="'pipeline.noDeals' | translate" [description]="'pipeline.noDealsHint' | translate">
          <button type="button" class="btn btn-primary" (click)="newDeal()">{{ 'quickCreate.deal' | translate }}</button>
        </ui-empty-state>
      } @else if (!store.loading() && store.filtered().length === 0 && store.activeFilters() > 0 && store.view() === 'list') {
        <ui-empty-state class="card" icon="search-x" [heading]="'pipeline.noResults' | translate" [description]="'pipeline.noResultsHint' | translate">
          <button type="button" class="btn btn-secondary" (click)="clear()">{{ 'common.clearFilters' | translate }}</button>
        </ui-empty-state>
      } @else if (store.view() === 'board') {
        <p class="mb-3 flex items-center gap-1.5 text-xs text-fg-subtle">
          <svg lucideIcon="grip-vertical" [size]="13" aria-hidden="true"></svg>{{ 'pipeline.dragHint' | translate }}
        </p>
        <app-pipeline-board [columns]="store.columns()" [loading]="store.loading()" (move)="move($event)" (create)="newDeal($event)" />
      } @else {
        <app-pipeline-list [deals]="store.filtered()" [loading]="store.loading()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelinePage {
  protected readonly store = inject(PipelineStore);
  protected readonly team = inject(TeamStore);
  private readonly language = inject(LanguageService);
  private readonly actions = inject(RecordActions);
  private readonly create = inject(QuickCreateService);

  protected readonly name = fullName;
  protected readonly stages = DEAL_STAGES;
  protected readonly priorities = PRIORITIES;
  protected readonly sorts = PIPELINE_SORTS;
  protected readonly ownerOptions = computed(() => [
    { value: 'all', label: this.language.t('filters.allOwners') },
    ...this.team.members().map((m) => ({ value: m.id, label: fullName(m) })),
  ]);
  protected readonly priorityOptions = computed(() => [{ value: 'all', label: this.language.t('filters.anyPriority') }, ...this.priorities.map((v) => ({ value: v, label: this.language.t(`enums.priority.${v}`) }))]);
  protected readonly stageOptions = computed(() => [{ value: 'all', label: this.language.t('filters.allStages') }, ...this.stages.map((v) => ({ value: v, label: this.language.t(`enums.stage.${v}`) }))]);
  protected readonly sortOptions = computed(() => [...this.sorts.map((v) => ({ value: v, label: this.language.t(`pipeline.sort.${v}`) }))]);

  /** Raw input value; the store receives it debounced. */
  protected readonly search = signal(this.store.query());
  private readonly debouncedSearch = debounced(this.search, 180);

  constructor() {
    effect(() => this.store.setQuery(this.debouncedSearch()));
  }

  protected move(event: { deal: Deal; stage: DealStage }): void {
    void this.actions.moveDeal(event.deal, event.stage);
  }

  protected newDeal(stage: DealStage = 'new'): void {
    void this.create.deal({ stage });
  }

  protected setPriority(value: string): void {
    this.store.setPriority(value as Priority | 'all');
  }

  protected setStage(value: string): void {
    this.store.setStage(value as DealStage | 'all');
  }

  protected setSort(value: string): void {
    this.store.setSort(value as PipelineSort);
  }

  protected clear(): void {
    this.search.set('');
    this.store.clearFilters();
  }
}
