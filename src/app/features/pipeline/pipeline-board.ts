import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { Deal, DealStage } from '../../core/models';
import { STAGE_COLOR_VAR } from '../../shared/domain/domain-badges';
import { MoneyPipe } from '../../shared/pipes/locale-pipes';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { Skeleton } from '../../shared/ui/skeleton';
import { DealCard } from './deal-card';
import { PipelineColumn } from './pipeline.store';

/**
 * Kanban board. Columns are vertical CDK drop lists joined in one group; moving
 * a card between columns emits `move` — the store update re-renders the board.
 * Long-press starts a drag on touch devices so horizontal scrolling still works.
 */
@Component({
  selector: 'app-pipeline-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    CdkScrollable,
    DealCard,
    LucideDynamicIcon,
    TranslatePipe,
    PluralPipe,
    MoneyPipe,
    Skeleton,
  ],
  template: `
    <div
      cdkScrollable
      cdkDropListGroup
      class="board -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:snap-none lg:px-8"
      role="region"
      [attr.aria-label]="'pipeline.boardLabel' | translate"
      data-testid="pipeline-board"
    >
      @for (column of columns(); track column.stage) {
        <section
          class="flex w-[min(19rem,84vw)] shrink-0 snap-start flex-col rounded-2xl border border-line-subtle bg-surface-sunken/70"
          [attr.aria-label]="'pipeline.columnLabel' | plural: column.deals.length : { stage: ('enums.stage.' + column.stage | translate) }"
          [attr.data-stage]="column.stage"
          data-testid="pipeline-column"
        >
          <header class="flex items-center gap-2 px-3.5 pt-3 pb-2">
            <span class="size-2 shrink-0 rounded-full" [style.background]="color[column.stage]" aria-hidden="true"></span>
            <h2 class="text-[0.8125rem] font-semibold text-fg">{{ 'enums.stage.' + column.stage | translate }}</h2>
            <span class="rounded-full bg-surface px-1.5 text-2xs leading-4.5 font-semibold text-fg-muted shadow-xs tabular" data-testid="column-count">{{
              column.deals.length
            }}</span>
            <span class="ms-auto text-xs font-medium text-fg-muted tabular" data-testid="column-total">{{ column.total | money: 'compact' }}</span>
            <button
              type="button"
              class="btn btn-ghost btn-icon btn-sm -me-1.5 size-7"
              (click)="create.emit(column.stage)"
              [attr.aria-label]="('quickCreate.deal' | translate) + ' — ' + ('enums.stage.' + column.stage | translate)"
            >
              <svg lucideIcon="plus" [size]="15" aria-hidden="true"></svg>
            </button>
          </header>
          <div class="mx-3.5 mb-2 h-0.5 rounded-full opacity-60" [style.background]="color[column.stage]" aria-hidden="true"></div>

          <div
            cdkDropList
            [cdkDropListData]="column.stage"
            (cdkDropListDropped)="onDrop($event)"
            class="drop-list flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-1 pb-3"
            [class.is-target]="dragging()"
            role="list"
          >
            @if (loading()) {
              @for (i of [1, 2, 3]; track i) {
                <div class="rounded-xl border border-line bg-surface p-3.5">
                  <ui-skeleton class="h-4 w-3/4" />
                  <ui-skeleton class="mt-2 h-3 w-1/2" />
                  <ui-skeleton class="mt-4 h-4 w-1/3" />
                </div>
              }
            } @else {
              @for (deal of column.deals; track deal.id) {
                <app-deal-card
                  cdkDrag
                  [cdkDragData]="deal"
                  [cdkDragStartDelay]="{ touch: 250, mouse: 0 }"
                  (cdkDragStarted)="dragging.set(true)"
                  (cdkDragEnded)="dragging.set(false)"
                  [deal]="deal"
                  role="listitem"
                >
                  <div *cdkDragPlaceholder class="h-28 rounded-xl border-2 border-dashed border-primary-border bg-primary-soft/50"></div>
                </app-deal-card>
              } @empty {
                <div class="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-3 py-8 text-center">
                  <p class="text-xs font-medium text-fg-subtle">
                    {{ (dragging() ? 'pipeline.dropHere' : 'pipeline.emptyColumn') | translate }}
                  </p>
                </div>
              }
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .drop-list {
      max-height: calc(100dvh - 17rem);
      border-radius: 0.75rem;
      transition: background-color 160ms ease;
    }
    .drop-list.cdk-drop-list-receiving,
    .drop-list.cdk-drop-list-dragging {
      background: color-mix(in oklab, var(--primary) 5%, transparent);
    }
    @media (max-width: 1023px) {
      .drop-list {
        max-height: calc(100dvh - 19rem);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineBoard {
  private readonly router = inject(Router);

  readonly columns = input.required<PipelineColumn[]>();
  readonly loading = input(false);
  readonly move = output<{ deal: Deal; stage: DealStage }>();
  readonly create = output<DealStage>();

  protected readonly dragging = signal(false);
  protected readonly color = STAGE_COLOR_VAR;

  protected onDrop(event: CdkDragDrop<DealStage, DealStage, Deal>): void {
    if (event.previousContainer === event.container) return;
    this.move.emit({ deal: event.item.data, stage: event.container.data });
  }
}
