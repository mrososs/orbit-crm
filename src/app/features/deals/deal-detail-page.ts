import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { dealProbability, isDealOverdue, weightedValue } from '../../core/domain/deal-rules';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { DealStage, fullName } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { ToastService } from '../../core/services/toast.service';
import { OwnerChip, PriorityBadge, StageBadge } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';
import { TaskItem } from '../../shared/domain/task-item';
import { Timeline } from '../../shared/domain/timeline';
import { LocalDatePipe, MoneyPipe, PercentPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { CrmService } from '../../state/crm.service';
import { ActivitiesStore, CompaniesStore, ContactsStore, DealsStore, TimelineStore } from '../../state/entity-stores';
import { DealStageStepper } from './deal-stage-stepper';

@Component({
  selector: 'app-deal-detail-page',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    StageBadge,
    PriorityBadge,
    OwnerChip,
    Avatar,
    Button,
    EmptyState,
    Skeleton,
    TaskItem,
    Timeline,
    MoneyPipe,
    PercentPipe,
    LocalDatePipe,
    DealStageStepper,
  ],
  template: `
    <div class="page animate-rise-in">
      <a routerLink="/pipeline" class="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <svg lucideIcon="arrow-left" [size]="15" class="rtl-flip" aria-hidden="true"></svg>{{ 'deals.backToPipeline' | translate }}
      </a>

      @if (deals.isLoading()) {
        <div class="card p-6">
          <ui-skeleton class="h-7 w-72" />
          <ui-skeleton class="mt-3 h-4 w-48" />
          <ui-skeleton class="mt-6 h-10 w-full" />
        </div>
      } @else if (!deal()) {
        <ui-empty-state class="card" icon="search-x" [heading]="'deals.notFound' | translate" [description]="'deals.notFoundHint' | translate">
          <a routerLink="/pipeline" class="btn btn-secondary">{{ 'deals.backToPipeline' | translate }}</a>
        </ui-empty-state>
      } @else {
        @let d = deal()!;
        <section class="card overflow-hidden" aria-labelledby="deal-title">
          <div class="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex min-w-0 items-start gap-4">
              <ui-avatar [name]="company()?.name ?? d.name" size="xl" [square]="true" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <app-stage-badge [stage]="d.stage" data-testid="deal-stage-badge" />
                  <app-priority-badge [priority]="d.priority" />
                </div>
                <h1 id="deal-title" class="mt-2 text-xl font-semibold tracking-[-0.02em] text-fg sm:text-2xl" data-testid="deal-title">{{ d.name }}</h1>
                <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                  @if (company(); as c) {
                    <a [routerLink]="['/companies', c.id]" class="link font-normal text-fg-muted">{{ c.name }}</a>
                  }
                  @if (company() && contact()) {
                    <span aria-hidden="true">·</span>
                  }
                  @if (contact(); as ct) {
                    <a [routerLink]="['/contacts', ct.id]" class="link font-normal text-fg-muted">{{ contactName() }}</a>
                  }
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-3 lg:items-end">
              <p class="text-3xl font-semibold tracking-[-0.03em] text-fg tabular" data-testid="deal-value">{{ d.value | money }}</p>
              <div class="flex flex-wrap gap-2">
                @if (d.stage !== 'won' && d.stage !== 'lost') {
                  <button ui-button size="sm" icon="trophy" (click)="move('won')" data-testid="mark-won">{{ 'deals.markWon' | translate }}</button>
                  <button ui-button size="sm" icon="circle-x" (click)="move('lost')">{{ 'deals.markLost' | translate }}</button>
                } @else {
                  <button ui-button size="sm" icon="rotate-ccw" (click)="move('negotiation')">{{ 'deals.reopen' | translate }}</button>
                }
                <button ui-button size="sm" icon="pencil" (click)="actions.editDeal(d)" data-testid="edit-deal">{{ 'common.edit' | translate }}</button>
                <button ui-button size="sm" variant="ghost" icon="trash" iconOnly (click)="remove()" [attr.aria-label]="'common.delete' | translate"></button>
              </div>
            </div>
          </div>
          <div class="border-t border-line-subtle bg-surface-sunken/50 px-5 py-4 sm:px-6">
            <app-deal-stage-stepper [stage]="d.stage" [lostAtStage]="d.lostAtStage" (changed)="move($event)" />
            <p class="mt-3 text-xs text-fg-muted">
              @if (d.stage === 'won') {
                {{ 'deals.closedWon' | translate: { date: (d.closedAt | localDate: 'long') } }}
              } @else if (d.stage === 'lost') {
                {{ 'deals.closedLost' | translate: { date: (d.closedAt | localDate: 'long') } }}
              } @else {
                <span [class.text-danger]="overdue()">{{ 'deals.expectedClose' | translate: { date: (d.expectedCloseDate | localDate: 'long') } }}</span>
              }
            </p>
          </div>
        </section>

        <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div class="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <!-- Notes -->
            <section class="card" aria-labelledby="notes-title">
              <div class="card-header">
                <h2 id="notes-title" class="card-title">{{ 'deals.notes' | translate }}</h2>
                @if (notesDirty()) {
                  <button ui-button size="sm" variant="primary" [loading]="savingNotes()" (click)="saveNotes()" data-testid="save-notes">
                    {{ 'deals.saveNotes' | translate }}
                  </button>
                }
              </div>
              <div class="px-5 pb-5">
                <label class="sr-only" for="deal-notes-input">{{ 'deals.notes' | translate }}</label>
                <textarea
                  id="deal-notes-input"
                  rows="4"
                  class="control"
                  [value]="notes()"
                  (input)="notes.set($any($event.target).value)"
                  [placeholder]="'deals.fields.notesPlaceholder' | translate"
                  data-testid="deal-notes"
                ></textarea>
              </div>
            </section>

            <!-- Tasks -->
            <section class="card overflow-hidden" aria-labelledby="tasks-title">
              <div class="card-header">
                <h2 id="tasks-title" class="card-title">{{ 'deals.tasks' | translate }}</h2>
                <button ui-button size="sm" icon="plus" (click)="addTask()" data-testid="add-task">{{ 'deals.addTask' | translate }}</button>
              </div>
              @if (tasks().length === 0) {
                <ui-empty-state compact icon="list-checks" [heading]="'deals.noTasks' | translate" />
              } @else {
                <div class="divide-y divide-line-subtle border-t border-line-subtle">
                  @for (task of tasks(); track task.id) {
                    <app-task-item [activity]="task" [showDeal]="false" />
                  }
                </div>
              }
            </section>

            <!-- Timeline -->
            <section class="card" aria-labelledby="timeline-title">
              <div class="card-header">
                <h2 id="timeline-title" class="card-title">{{ 'deals.timeline' | translate }}</h2>
              </div>
              <div class="px-5 pb-5">
                <app-timeline [events]="events()" [emptyText]="'deals.noTimeline' | translate" />
              </div>
            </section>
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <!-- Overview -->
            <section class="card" aria-labelledby="overview-title">
              <div class="card-header">
                <h2 id="overview-title" class="card-title">{{ 'deals.overview' | translate }}</h2>
              </div>
              <dl class="divide-y divide-line-subtle px-5 pb-2 text-sm">
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.probability' | translate }}</dt>
                  <dd class="font-medium text-fg tabular">{{ probability() | pct }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.weighted' | translate }}</dt>
                  <dd class="font-medium text-fg tabular">{{ weighted() | money }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.owner' | translate }}</dt>
                  <dd class="min-w-0"><app-owner [ownerId]="d.ownerId" /></dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.closeDate' | translate }}</dt>
                  <dd class="font-medium text-fg tabular" [class.text-danger]="overdue()">{{ d.expectedCloseDate | localDate }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.source' | translate }}</dt>
                  <dd class="font-medium text-fg">{{ 'enums.source.' + d.source | translate }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.created' | translate }}</dt>
                  <dd class="text-fg tabular">{{ d.createdAt | localDate }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3 py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.updated' | translate }}</dt>
                  <dd class="text-fg tabular">{{ d.updatedAt | localDate }}</dd>
                </div>
                @if (d.stage === 'lost' && d.lostAtStage) {
                  <div class="flex items-center justify-between gap-3 py-2.5">
                    <dt class="text-fg-muted">{{ 'deals.fields.lostAt' | translate }}</dt>
                    <dd class="font-medium text-fg">{{ 'enums.stage.' + d.lostAtStage | translate }}</dd>
                  </div>
                }
                <div class="py-2.5">
                  <dt class="text-fg-muted">{{ 'deals.fields.tags' | translate }}</dt>
                  <dd class="mt-2 flex flex-wrap gap-1.5">
                    @for (tag of d.tags; track tag) {
                      <span class="ltr-content rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-medium text-fg-muted">#{{ tag }}</span>
                    } @empty {
                      <span class="text-fg-subtle">{{ 'deals.noTags' | translate }}</span>
                    }
                  </dd>
                </div>
              </dl>
            </section>

            <!-- Company & contact -->
            <section class="card" aria-labelledby="rel-title">
              <div class="card-header">
                <h2 id="rel-title" class="card-title">{{ 'deals.relationships' | translate }}</h2>
              </div>
              <div class="flex flex-col gap-2 px-5 pb-5">
                @if (company(); as c) {
                  <a [routerLink]="['/companies', c.id]" class="flex items-center gap-3 rounded-lg border border-line-subtle p-3 transition-colors hover:border-line-strong hover:bg-surface-hover">
                    <ui-avatar [name]="c.name" size="lg" [square]="true" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-fg">{{ c.name }}</p>
                      <p class="truncate text-xs text-fg-muted">{{ 'enums.industry.' + c.industry | translate }} · {{ c.city }}</p>
                    </div>
                    <svg lucideIcon="chevron-right" [size]="15" class="rtl-flip text-fg-subtle" aria-hidden="true"></svg>
                  </a>
                } @else {
                  <p class="rounded-lg border border-dashed border-line p-3 text-sm text-fg-subtle">{{ 'deals.noCompany' | translate }}</p>
                }
                @if (contact(); as ct) {
                  <a [routerLink]="['/contacts', ct.id]" class="flex items-center gap-3 rounded-lg border border-line-subtle p-3 transition-colors hover:border-line-strong hover:bg-surface-hover">
                    <ui-avatar [name]="contactName()" size="lg" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-fg">{{ contactName() }}</p>
                      <p class="truncate text-xs text-fg-muted">{{ ct.jobTitle }}</p>
                      <p class="ltr-content truncate text-xs text-fg-subtle">{{ ct.email }}</p>
                    </div>
                    <svg lucideIcon="chevron-right" [size]="15" class="rtl-flip text-fg-subtle" aria-hidden="true"></svg>
                  </a>
                } @else {
                  <p class="rounded-lg border border-dashed border-line p-3 text-sm text-fg-subtle">{{ 'deals.noContactLinked' | translate }}</p>
                }
              </div>
            </section>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealDetailPage {
  protected readonly deals = inject(DealsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly contacts = inject(ContactsStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly timeline = inject(TimelineStore);
  private readonly crm = inject(CrmService);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(CLOCK);
  private readonly create = inject(QuickCreateService);
  protected readonly actions = inject(RecordActions);

  /** Route parameter (component input binding). */
  readonly id = input.required<string>();

  protected readonly deal = computed(() => this.deals.entityMap()[this.id()]);
  protected readonly company = computed(() => {
    const id = this.deal()?.companyId;
    return id ? this.companies.entityMap()[id] : undefined;
  });
  protected readonly contact = computed(() => {
    const id = this.deal()?.contactId;
    return id ? this.contacts.entityMap()[id] : undefined;
  });
  protected readonly contactName = computed(() => {
    const c = this.contact();
    return c ? fullName(c) : '';
  });
  protected readonly probability = computed(() => (this.deal() ? dealProbability(this.deal()!) / 100 : 0));
  protected readonly weighted = computed(() => (this.deal() ? weightedValue(this.deal()!) : 0));
  protected readonly overdue = computed(() => (this.deal() ? isDealOverdue(this.deal()!, this.clock()) : false));
  protected readonly tasks = computed(() =>
    (this.activities.byDeal().get(this.id()) ?? [])
      .filter((a) => a.completedAt === null)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
  );
  protected readonly events = computed(() => this.timeline.recent().filter((e) => e.dealId === this.id()));

  private readonly savedNotes = computed(() => this.deal()?.notes ?? '');
  protected readonly notes = signal('');
  protected readonly savingNotes = signal(false);
  protected readonly notesDirty = computed(() => this.savedNotes() !== this.notes());

  constructor() {
    // Sync the editor when navigating between deals or after external edits.
    effect(() => {
      const value = this.savedNotes();
      untracked(() => this.notes.set(value));
    });
  }

  protected move(stage: DealStage): void {
    const d = this.deal();
    if (d) void this.actions.moveDeal(d, stage);
  }

  protected async saveNotes(): Promise<void> {
    const d = this.deal();
    if (!d) return;
    this.savingNotes.set(true);
    try {
      await this.crm.updateDeal(d.id, { notes: this.notes().trim() });
      this.toast.success('deals.notesSaved');
    } catch {
      this.toast.error('errors.saveFailed');
    } finally {
      this.savingNotes.set(false);
    }
  }

  protected addTask(): void {
    const d = this.deal();
    if (d) void this.create.activity({ dealId: d.id, contactId: d.contactId, ownerId: d.ownerId });
  }

  protected remove(): void {
    const d = this.deal();
    if (d) void this.actions.deleteDeal(d, '/pipeline');
  }
}
