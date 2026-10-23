import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
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
import { SelectValue } from '../../shared/directives/select-value';

@Component({
  selector: 'app-pipeline-page',
  imports: [SelectValue, TranslatePipe, PluralPipe, LucideDynamicIcon, PipelineBoard, PipelineList, EmptyState, MoneyPipe],
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
          <label class="sr-only" for="pipeline-owner">{{ 'filters.owner' | translate }}</label>
          <select id="pipeline-owner" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.ownerId()" (change)="store.setOwner($any($event.target).value)" data-testid="filter-owner">
            <option value="all">{{ 'filters.allOwners' | translate }}</option>
            @for (m of team.members(); track m.id) {
              <option [value]="m.id">{{ name(m) }}</option>
            }
          </select>
          <label class="sr-only" for="pipeline-priority">{{ 'filters.priority' | translate }}</label>
          <select id="pipeline-priority" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.priority()" (change)="setPriority($event)" data-testid="filter-priority">
            <option value="all">{{ 'filters.anyPriority' | translate }}</option>
            @for (p of priorities; track p) {
              <option [value]="p">{{ 'enums.priority.' + p | translate }}</option>
            }
          </select>
          <label class="sr-only" for="pipeline-stage">{{ 'filters.stage' | translate }}</label>
          <select id="pipeline-stage" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.stage()" (change)="setStage($event)" data-testid="filter-stage">
            <option value="all">{{ 'filters.allStages' | translate }}</option>
            @for (s of stages; track s) {
              <option [value]="s">{{ 'enums.stage.' + s | translate }}</option>
            }
          </select>
          <label class="sr-only" for="pipeline-sort">{{ 'filters.sortBy' | translate }}</label>
          <select id="pipeline-sort" class="control control-sm sm:w-auto sm:max-w-60" [uiValue]="store.sort()" (change)="setSort($event)" data-testid="pipeline-sort">
            @for (s of sorts; track s) {
              <option [value]="s">{{ 'pipeline.sort.' + s | translate }}</option>
            }
          </select>
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
  private readonly actions = inject(RecordActions);
  private readonly create = inject(QuickCreateService);

  protected readonly name = fullName;
  protected readonly stages = DEAL_STAGES;
  protected readonly priorities = PRIORITIES;
  protected readonly sorts = PIPELINE_SORTS;

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

  protected setPriority(event: Event): void {
    this.store.setPriority((event.target as HTMLSelectElement).value as Priority | 'all');
  }

  protected setStage(event: Event): void {
    this.store.setStage((event.target as HTMLSelectElement).value as DealStage | 'all');
  }

  protected setSort(event: Event): void {
    this.store.setSort((event.target as HTMLSelectElement).value as PipelineSort);
  }

  protected clear(): void {
    this.search.set('');
    this.store.clearFilters();
  }
}
