import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { fullName, isOpenStage } from '../../core/models';
import { OwnerChip, StageBadge, StatusBadge } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';
import { TaskItem } from '../../shared/domain/task-item';
import { Timeline } from '../../shared/domain/timeline';
import { LocalDatePipe, MoneyPipe, RegionPipe, RelativeTimePipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { TabItem, Tabs } from '../../shared/ui/tabs';
import { ActivitiesStore, CompaniesStore, ContactsStore, DealsStore, TimelineStore } from '../../state/entity-stores';

type ContactTab = 'overview' | 'activity' | 'deals' | 'tasks';

@Component({
  selector: 'app-contact-detail-page',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    Avatar,
    Button,
    StatusBadge,
    StageBadge,
    OwnerChip,
    Tabs,
    TaskItem,
    Timeline,
    EmptyState,
    Skeleton,
    MoneyPipe,
    LocalDatePipe,
    RelativeTimePipe,
    RegionPipe,
  ],
  template: `
    <div class="page animate-rise-in">
      <a routerLink="/contacts" class="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <svg lucideIcon="arrow-left" [size]="15" class="rtl-flip" aria-hidden="true"></svg>{{ 'contacts.back' | translate }}
      </a>

      @if (contacts.isLoading()) {
        <div class="card flex items-center gap-4 p-6">
          <ui-skeleton class="size-16 rounded-full" />
          <div class="flex-1"><ui-skeleton class="h-6 w-56" /><ui-skeleton class="mt-2 h-4 w-40" /></div>
        </div>
      } @else if (!contact()) {
        <ui-empty-state class="card" icon="search-x" [heading]="'contacts.notFound' | translate" [description]="'contacts.notFoundHint' | translate">
          <a routerLink="/contacts" class="btn btn-secondary">{{ 'contacts.back' | translate }}</a>
        </ui-empty-state>
      } @else {
        @let c = contact()!;
        <section class="card overflow-hidden" aria-labelledby="contact-name">
          <div class="h-16 bg-gradient-to-r from-primary-soft via-surface-sunken to-surface rtl:bg-gradient-to-l" aria-hidden="true"></div>
          <div class="flex flex-col gap-4 px-5 pb-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex min-w-0 items-start gap-4">
              <ui-avatar class="-mt-7 shrink-0 ring-4 ring-surface" [name]="name()" size="xl" />
              <div class="min-w-0 pt-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 id="contact-name" class="text-xl font-semibold tracking-[-0.02em] text-fg sm:text-2xl" data-testid="contact-heading">{{ name() }}</h1>
                  <app-status-badge [status]="c.status" />
                </div>
                <p class="mt-0.5 text-sm text-fg-muted">
                  @if (company(); as co) {
                    @if (c.jobTitle) {
                      {{ 'contacts.roleAt' | translate: { title: c.jobTitle, company: co.name } }}
                    } @else {
                      {{ co.name }}
                    }
                  } @else {
                    {{ c.jobTitle }}
                  }
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 lg:pt-3">
              <a ui-button size="sm" icon="mail" [href]="'mailto:' + c.email">{{ 'contacts.sendEmail' | translate }}</a>
              @if (c.phone) {
                <a ui-button size="sm" icon="phone" [href]="'tel:' + phoneHref()">{{ 'contacts.call' | translate }}</a>
              }
              <button ui-button size="sm" variant="primary" icon="calendar-check" (click)="logActivity()" data-testid="log-activity">
                {{ 'contacts.logActivity' | translate }}
              </button>
              <button ui-button size="sm" icon="pencil" (click)="actions.editContact(c)" data-testid="edit-contact">{{ 'common.edit' | translate }}</button>
              <button ui-button size="sm" variant="ghost" icon="trash" iconOnly (click)="actions.deleteContact(c, '/contacts')" [attr.aria-label]="'common.delete' | translate" data-testid="delete-contact"></button>
            </div>
          </div>

          <dl class="grid grid-cols-2 border-t border-line-subtle lg:grid-cols-4">
            <div class="border-e border-b border-line-subtle px-5 py-4 lg:border-b-0">
              <dt class="text-xs text-fg-muted">{{ 'contacts.openDeals' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg tabular">{{ stats().openDeals }}</dd>
            </div>
            <div class="border-b border-line-subtle px-5 py-4 lg:border-e lg:border-b-0">
              <dt class="text-xs text-fg-muted">{{ 'contacts.pipelineValue' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg tabular">{{ stats().pipeline | money }}</dd>
            </div>
            <div class="border-e border-line-subtle px-5 py-4">
              <dt class="text-xs text-fg-muted">{{ 'contacts.wonRevenue' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-success tabular">{{ stats().won | money }}</dd>
            </div>
            <div class="px-5 py-4">
              <dt class="text-xs text-fg-muted">{{ 'contacts.lastInteraction' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg">
                {{ c.lastInteractionAt ? (c.lastInteractionAt | relativeTime) : ('common.never' | translate) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="card mt-4 overflow-hidden">
          <ui-tabs class="px-3" idPrefix="contact" [tabs]="tabs()" [(active)]="tab" [label]="name()" />
          <div id="contact-panel" role="tabpanel" [attr.aria-labelledby]="'contact-tab-' + tab()" class="min-h-64">
            @switch (tab()) {
              @case ('overview') {
                <div class="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-2">
                  <div>
                    <h2 class="text-sm font-semibold text-fg">{{ 'contacts.details' | translate }}</h2>
                    <dl class="mt-3 divide-y divide-line-subtle text-sm">
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.email' | translate }}</dt>
                        <dd class="min-w-0 truncate"><a class="ltr-content text-fg hover:text-primary" [href]="'mailto:' + c.email">{{ c.email }}</a></dd>
                      </div>
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.phone' | translate }}</dt>
                        <dd class="ltr-content text-fg">{{ c.phone || '—' }}</dd>
                      </div>
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.company' | translate }}</dt>
                        <dd class="min-w-0 truncate">
                          @if (company(); as co) {
                            <a [routerLink]="['/companies', co.id]" class="link">{{ co.name }}</a>
                          } @else {
                            <span class="text-fg-subtle">{{ 'contacts.fields.noCompany' | translate }}</span>
                          }
                        </dd>
                      </div>
                      @if (company(); as co) {
                        <div class="flex items-center justify-between gap-4 py-2.5">
                          <dt class="text-fg-muted">{{ 'companies.columns.location' | translate }}</dt>
                          <dd class="text-fg">{{ co.city }}, {{ co.countryCode | region }}</dd>
                        </div>
                      }
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.owner' | translate }}</dt>
                        <dd><app-owner [ownerId]="c.ownerId" /></dd>
                      </div>
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.source' | translate }}</dt>
                        <dd class="text-fg">{{ 'enums.source.' + c.source | translate }}</dd>
                      </div>
                      <div class="flex items-center justify-between gap-4 py-2.5">
                        <dt class="text-fg-muted">{{ 'contacts.fields.created' | translate }}</dt>
                        <dd class="text-fg tabular">{{ c.createdAt | localDate: 'long' }}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h2 class="text-sm font-semibold text-fg">{{ 'contacts.fields.notes' | translate }}</h2>
                    @if (c.notes) {
                      <p class="mt-3 rounded-xl border border-line-subtle bg-surface-sunken/60 p-4 text-sm leading-6 whitespace-pre-line text-fg">{{ c.notes }}</p>
                    } @else {
                      <p class="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-fg-subtle">{{ 'contacts.noNotes' | translate }}</p>
                    }
                    <h2 class="mt-6 text-sm font-semibold text-fg">{{ 'activities.upcomingTitle' | translate }}</h2>
                    <div class="mt-2 overflow-hidden rounded-xl border border-line-subtle">
                      @for (task of openTasks().slice(0, 3); track task.id) {
                        <app-task-item class="border-b border-line-subtle last:border-b-0" [activity]="task" [showContact]="false" />
                      } @empty {
                        <p class="p-4 text-sm text-fg-subtle">{{ 'activities.upcomingEmpty' | translate }}</p>
                      }
                    </div>
                  </div>
                </div>
              }
              @case ('activity') {
                <div class="p-5 sm:p-6">
                  <app-timeline [events]="events()" [emptyText]="'contacts.noActivity' | translate" />
                </div>
              }
              @case ('deals') {
                <div class="flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
                  <p class="text-sm text-fg-muted">{{ 'contacts.tabs.deals' | translate }} · {{ deals().length }}</p>
                  <button ui-button size="sm" icon="plus" (click)="newDeal()">{{ 'quickCreate.deal' | translate }}</button>
                </div>
                @if (deals().length === 0) {
                  <ui-empty-state compact icon="briefcase" [heading]="'contacts.noDeals' | translate" />
                } @else {
                  <ul class="mt-3 divide-y divide-line-subtle border-t border-line-subtle">
                    @for (d of deals(); track d.id) {
                      <li>
                        <a [routerLink]="['/deals', d.id]" class="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6">
                          <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium text-fg">{{ d.name }}</p>
                            <p class="text-xs text-fg-muted">{{ 'deals.fields.closeDate' | translate }} · {{ d.expectedCloseDate | localDate }}</p>
                          </div>
                          <app-stage-badge [stage]="d.stage" />
                          <span class="w-24 text-end text-sm font-semibold text-fg tabular">{{ d.value | money }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                }
              }
              @case ('tasks') {
                <div class="flex items-center justify-end px-5 pt-4 sm:px-6">
                  <button ui-button size="sm" icon="plus" (click)="logActivity()">{{ 'quickCreate.activity' | translate }}</button>
                </div>
                @if (tasks().length === 0) {
                  <ui-empty-state compact icon="list-checks" [heading]="'contacts.noTasks' | translate" />
                } @else {
                  <div class="mt-3 divide-y divide-line-subtle border-t border-line-subtle">
                    @for (task of tasks(); track task.id) {
                      <app-task-item [activity]="task" [showContact]="false" />
                    }
                  </div>
                }
              }
            }
          </div>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactDetailPage {
  protected readonly contacts = inject(ContactsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly dealsStore = inject(DealsStore);
  private readonly activities = inject(ActivitiesStore);
  private readonly timeline = inject(TimelineStore);
  private readonly language = inject(LanguageService);
  private readonly create = inject(QuickCreateService);
  protected readonly actions = inject(RecordActions);

  readonly id = input.required<string>();
  protected readonly tab = signal<ContactTab | string>('overview');

  protected readonly contact = computed(() => this.contacts.entityMap()[this.id()]);
  protected readonly name = computed(() => (this.contact() ? fullName(this.contact()!) : ''));
  protected readonly phoneHref = computed(() => (this.contact()?.phone ?? '').replace(/[^\d+]/g, ''));
  protected readonly company = computed(() => {
    const id = this.contact()?.companyId;
    return id ? this.companies.entityMap()[id] : undefined;
  });
  protected readonly deals = computed(() =>
    [...(this.dealsStore.byContact().get(this.id()) ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  protected readonly tasks = computed(() =>
    [...(this.activities.byContact().get(this.id()) ?? [])].sort((a, b) => {
      if ((a.completedAt === null) !== (b.completedAt === null)) return a.completedAt === null ? -1 : 1;
      return a.completedAt === null ? a.dueAt.localeCompare(b.dueAt) : b.completedAt!.localeCompare(a.completedAt!);
    }),
  );
  protected readonly openTasks = computed(() => this.tasks().filter((t) => t.completedAt === null));
  protected readonly events = computed(() => this.timeline.recent().filter((e) => e.contactId === this.id()));
  protected readonly stats = computed(() => {
    const deals = this.deals();
    const open = deals.filter((d) => isOpenStage(d.stage));
    return {
      openDeals: open.length,
      pipeline: open.reduce((sum, d) => sum + d.value, 0),
      won: deals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + d.value, 0),
    };
  });

  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'overview', label: this.language.t('contacts.tabs.overview') },
    { id: 'activity', label: this.language.t('contacts.tabs.activity'), count: this.events().length },
    { id: 'deals', label: this.language.t('contacts.tabs.deals'), count: this.deals().length },
    { id: 'tasks', label: this.language.t('contacts.tabs.tasks'), count: this.openTasks().length },
  ]);

  protected logActivity(): void {
    const c = this.contact();
    if (c) void this.create.activity({ contactId: c.id, ownerId: c.ownerId, type: 'call' });
  }

  protected newDeal(): void {
    const c = this.contact();
    if (c) void this.create.deal({ contactId: c.id, companyId: c.companyId, ownerId: c.ownerId, source: c.source });
  }
}
