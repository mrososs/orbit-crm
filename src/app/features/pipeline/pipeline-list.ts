import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { isDealOverdue } from '../../core/domain/deal-rules';
import { Deal } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { PreferencesService } from '../../core/services/preferences.service';
import { OwnerChip, PriorityBadge, StageBadge } from '../../shared/domain/domain-badges';
import { LocalDatePipe, MoneyPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { Skeleton } from '../../shared/ui/skeleton';
import { CompaniesStore } from '../../state/entity-stores';
import { DealMenu } from './stage-menu';

@Component({
  selector: 'app-pipeline-list',
  imports: [RouterLink, TranslatePipe, StageBadge, PriorityBadge, OwnerChip, Avatar, MoneyPipe, LocalDatePipe, DealMenu, Skeleton],
  template: `
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="data-table" [class.density-compact]="compact()" data-testid="pipeline-table">
          <thead>
            <tr>
              <th scope="col">{{ 'deals.fields.name' | translate }}</th>
              <th scope="col">{{ 'deals.fields.stage' | translate }}</th>
              <th scope="col" class="text-end">{{ 'deals.fields.value' | translate }}</th>
              <th scope="col" class="hidden md:table-cell">{{ 'deals.fields.owner' | translate }}</th>
              <th scope="col" class="hidden lg:table-cell">{{ 'deals.fields.closeDate' | translate }}</th>
              <th scope="col" class="hidden page-xl:table-cell">{{ 'deals.fields.priority' | translate }}</th>
              <th scope="col"><span class="sr-only">{{ 'common.actions' | translate }}</span></th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <tr>
                  <td colspan="7"><ui-skeleton class="h-4 w-full" /></td>
                </tr>
              }
            } @else {
              @for (row of rows(); track row.deal.id) {
                <tr class="is-clickable" (click)="open(row.deal)">
                  <td class="max-w-80">
                    <div class="flex items-center gap-3">
                      <ui-avatar [name]="row.company || row.deal.name" size="md" [square]="true" />
                      <div class="min-w-0">
                        <a
                          [routerLink]="['/deals', row.deal.id]"
                          class="block truncate font-medium text-fg hover:text-primary"
                          (click)="$event.stopPropagation()"
                          >{{ row.deal.name }}</a
                        >
                        <p class="truncate text-xs text-fg-muted">{{ row.company || ('deals.noCompany' | translate) }}</p>
                      </div>
                    </div>
                  </td>
                  <td><app-stage-badge [stage]="row.deal.stage" /></td>
                  <td class="text-end font-semibold text-fg tabular">{{ row.deal.value | money }}</td>
                  <td class="hidden md:table-cell"><app-owner [ownerId]="row.deal.ownerId" /></td>
                  <td class="hidden text-fg-muted tabular lg:table-cell" [class.text-danger]="row.overdue">
                    {{ row.deal.expectedCloseDate | localDate }}
                  </td>
                  <td class="hidden page-xl:table-cell"><app-priority-badge [priority]="row.deal.priority" /></td>
                  <td class="w-12 text-end" (click)="$event.stopPropagation()">
                    <app-deal-menu [deal]="row.deal" />
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineList {
  private readonly router = inject(Router);
  private readonly companies = inject(CompaniesStore);
  private readonly clock = inject(CLOCK);
  private readonly prefs = inject(PreferencesService);

  readonly deals = input.required<Deal[]>();
  readonly loading = input(false);

  protected readonly compact = computed(() => this.prefs.density() === 'compact');
  protected readonly rows = computed(() => {
    const map = this.companies.entityMap();
    const now = this.clock();
    return this.deals().map((deal) => ({
      deal,
      company: deal.companyId ? (map[deal.companyId]?.name ?? '') : '',
      overdue: isDealOverdue(deal, now),
    }));
  });

  protected open(deal: Deal): void {
    void this.router.navigate(['/deals', deal.id]);
  }
}
