import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { fullName, isOpenStage } from '../../core/models';
import { OwnerChip, StageBadge, StatusBadge } from '../../shared/domain/domain-badges';
import { RecordActions } from '../../shared/domain/record-actions';
import { Timeline } from '../../shared/domain/timeline';
import { LocalDatePipe, MoneyPipe, RegionPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { websiteHost } from '../../shared/utils/text';
import { CompaniesStore, ContactsStore, DealsStore, TimelineStore } from '../../state/entity-stores';

@Component({
  selector: 'app-company-detail-page',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    TranslatePipe,
    Avatar,
    Button,
    OwnerChip,
    StageBadge,
    StatusBadge,
    Timeline,
    EmptyState,
    Skeleton,
    MoneyPipe,
    LocalDatePipe,
    RegionPipe,
  ],
  template: `
    <div class="page animate-rise-in">
      <a routerLink="/companies" class="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <svg lucideIcon="arrow-left" [size]="15" class="rtl-flip" aria-hidden="true"></svg>{{ 'companies.back' | translate }}
      </a>

      @if (companies.isLoading()) {
        <div class="card flex items-center gap-4 p-6">
          <ui-skeleton class="size-14 rounded-lg" />
          <div class="flex-1"><ui-skeleton class="h-6 w-56" /><ui-skeleton class="mt-2 h-4 w-40" /></div>
        </div>
      } @else if (!company()) {
        <ui-empty-state class="card" icon="search-x" [heading]="'companies.notFound' | translate" [description]="'companies.notFoundHint' | translate">
          <a routerLink="/companies" class="btn btn-secondary">{{ 'companies.back' | translate }}</a>
        </ui-empty-state>
      } @else {
        @let co = company()!;
        <section class="card overflow-hidden" aria-labelledby="company-name">
          <div class="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-center gap-4">
              <ui-avatar [name]="co.name" size="xl" [square]="true" />
              <div class="min-w-0">
                <h1 id="company-name" class="text-xl font-semibold tracking-[-0.02em] text-fg sm:text-2xl" data-testid="company-title">{{ co.name }}</h1>
                <p class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                  <span class="inline-flex items-center gap-1"><svg lucideIcon="briefcase" [size]="13" aria-hidden="true"></svg>{{ 'enums.industry.' + co.industry | translate }}</span>
                  <span class="inline-flex items-center gap-1"><svg lucideIcon="map-pin" [size]="13" aria-hidden="true"></svg>{{ co.city }}, {{ co.countryCode | region }}</span>
                  @if (co.website) {
                    <a [href]="co.website" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 hover:text-primary">
                      <svg lucideIcon="globe" [size]="13" aria-hidden="true"></svg><span class="ltr-content">{{ host(co.website) }}</span>
                    </a>
                  }
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button ui-button size="sm" icon="user-plus" (click)="addContact()">{{ 'companies.addContact' | translate }}</button>
              <button ui-button size="sm" variant="primary" icon="plus" (click)="addDeal()">{{ 'companies.addDeal' | translate }}</button>
              <button ui-button size="sm" icon="pencil" (click)="actions.editCompany(co)" data-testid="edit-company">{{ 'common.edit' | translate }}</button>
              <button ui-button size="sm" variant="ghost" icon="trash" iconOnly (click)="actions.deleteCompany(co, '/companies')" [attr.aria-label]="'common.delete' | translate"></button>
            </div>
          </div>
          <dl class="grid grid-cols-2 border-t border-line-subtle lg:grid-cols-4">
            <div class="border-e border-b border-line-subtle px-5 py-4 lg:border-b-0">
              <dt class="text-xs text-fg-muted">{{ 'companies.contacts' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg tabular">{{ contacts().length }}</dd>
            </div>
            <div class="border-b border-line-subtle px-5 py-4 lg:border-e lg:border-b-0">
              <dt class="text-xs text-fg-muted">{{ 'companies.openDeals' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg tabular">{{ stats().openDeals }}</dd>
            </div>
            <div class="border-e border-line-subtle px-5 py-4">
              <dt class="text-xs text-fg-muted">{{ 'companies.pipelineValue' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-fg tabular">{{ stats().pipeline | money }}</dd>
            </div>
            <div class="px-5 py-4">
              <dt class="text-xs text-fg-muted">{{ 'companies.totalValue' | translate }}</dt>
              <dd class="mt-1 text-lg font-semibold text-success tabular" data-testid="company-total">{{ stats().total | money }}</dd>
            </div>
          </dl>
        </section>

        <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div class="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <section class="card overflow-hidden" aria-labelledby="co-deals">
              <div class="card-header">
                <h2 id="co-deals" class="card-title">{{ 'companies.deals' | translate }} · {{ deals().length }}</h2>
                <button ui-button size="sm" icon="plus" (click)="addDeal()">{{ 'companies.addDeal' | translate }}</button>
              </div>
              @if (deals().length === 0) {
                <ui-empty-state compact icon="briefcase" [heading]="'companies.noDeals' | translate" />
              } @else {
                <ul class="divide-y divide-line-subtle border-t border-line-subtle">
                  @for (d of deals(); track d.id) {
                    <li>
                      <a [routerLink]="['/deals', d.id]" class="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover">
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
            </section>

            <section class="card overflow-hidden" aria-labelledby="co-contacts">
              <div class="card-header">
                <h2 id="co-contacts" class="card-title">{{ 'companies.contacts' | translate }} · {{ contacts().length }}</h2>
                <button ui-button size="sm" icon="user-plus" (click)="addContact()">{{ 'companies.addContact' | translate }}</button>
              </div>
              @if (contacts().length === 0) {
                <ui-empty-state compact icon="users" [heading]="'companies.noContacts' | translate" />
              } @else {
                <ul class="-mb-px grid grid-cols-1 border-t border-line-subtle sm:grid-cols-2">
                  @for (c of contacts(); track c.id) {
                    <li class="border-b border-line-subtle sm:odd:border-e">
                      <a [routerLink]="['/contacts', c.id]" class="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover">
                        <ui-avatar [name]="name(c)" size="md" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-fg">{{ name(c) }}</p>
                          <p class="truncate text-xs text-fg-muted">{{ c.jobTitle }}</p>
                        </div>
                        <app-status-badge [status]="c.status" />
                      </a>
                    </li>
                  }
                </ul>
              }
            </section>
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <section class="card" aria-labelledby="co-about">
              <div class="card-header"><h2 id="co-about" class="card-title">{{ 'companies.about' | translate }}</h2></div>
              <div class="px-5 pb-5">
                @if (co.description) {
                  <p class="text-sm leading-6 text-fg-muted">{{ co.description }}</p>
                }
                <dl class="mt-3 divide-y divide-line-subtle text-sm">
                  <div class="flex items-center justify-between gap-3 py-2.5">
                    <dt class="text-fg-muted">{{ 'companies.fields.size' | translate }}</dt>
                    <dd class="text-fg">{{ 'enums.companySize.' + co.size | translate }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-2.5">
                    <dt class="text-fg-muted">{{ 'companies.fields.owner' | translate }}</dt>
                    <dd><app-owner [ownerId]="co.ownerId" /></dd>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-2.5">
                    <dt class="text-fg-muted">{{ 'companies.wonRevenue' | translate }}</dt>
                    <dd class="font-medium text-fg tabular">{{ stats().won | money }}</dd>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-2.5">
                    <dt class="text-fg-muted">{{ 'companies.fields.created' | translate }}</dt>
                    <dd class="text-fg tabular">{{ co.createdAt | localDate: 'long' }}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section class="card" aria-labelledby="co-timeline">
              <div class="card-header"><h2 id="co-timeline" class="card-title">{{ 'companies.timeline' | translate }}</h2></div>
              <div class="px-5 pb-5">
                <app-timeline [events]="events()" [limit]="12" [emptyText]="'deals.noTimeline' | translate" />
              </div>
            </section>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDetailPage {
  protected readonly companies = inject(CompaniesStore);
  private readonly contactsStore = inject(ContactsStore);
  private readonly dealsStore = inject(DealsStore);
  private readonly timeline = inject(TimelineStore);
  private readonly create = inject(QuickCreateService);
  protected readonly actions = inject(RecordActions);

  readonly id = input.required<string>();

  protected readonly name = fullName;
  protected readonly host = websiteHost;
  protected readonly company = computed(() => this.companies.entityMap()[this.id()]);
  protected readonly contacts = computed(() =>
    [...(this.contactsStore.byCompany().get(this.id()) ?? [])].sort((a, b) => fullName(a).localeCompare(fullName(b))),
  );
  protected readonly deals = computed(() =>
    [...(this.dealsStore.byCompany().get(this.id()) ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  protected readonly events = computed(() => this.timeline.recent().filter((e) => e.companyId === this.id()));
  protected readonly stats = computed(() => {
    const deals = this.deals();
    const open = deals.filter((d) => isOpenStage(d.stage));
    const won = deals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + d.value, 0);
    const pipeline = open.reduce((sum, d) => sum + d.value, 0);
    return { openDeals: open.length, pipeline, won, total: won + pipeline };
  });

  protected addContact(): void {
    const co = this.company();
    if (co) void this.create.contact({ companyId: co.id, ownerId: co.ownerId });
  }

  protected addDeal(): void {
    const co = this.company();
    if (co) void this.create.deal({ companyId: co.id, ownerId: co.ownerId });
  }
}
