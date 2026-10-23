import { CdkDrag } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { isDealOverdue } from '../../core/domain/deal-rules';
import { LanguageService } from '../../core/i18n/language.service';
import { formatCurrency } from '../../core/i18n/locale.utils';
import { Deal } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { OwnerChip, PriorityBadge } from '../../shared/domain/domain-badges';
import { LocalDatePipe, MoneyPipe } from '../../shared/pipes/locale-pipes';
import { Avatar } from '../../shared/ui/avatar';
import { CompaniesStore } from '../../state/entity-stores';
import { DealMenu } from './stage-menu';

@Component({
  selector: 'app-deal-card',
  imports: [RouterLink, LucideDynamicIcon, TranslatePipe, OwnerChip, PriorityBadge, Avatar, MoneyPipe, LocalDatePipe, DealMenu],
  template: `
    <div class="flex items-start gap-2">
      <a
        [routerLink]="['/deals', deal().id]"
        class="line-clamp-2 min-w-0 flex-1 text-[0.875rem] leading-5 font-semibold text-fg after:absolute after:inset-0 after:rounded-xl hover:text-primary focus-visible:outline-none"
        [attr.aria-label]="label()"
        draggable="false"
        data-testid="deal-card-link"
        >{{ deal().name }}</a
      >
      <app-deal-menu class="relative z-[1] -me-1.5 -mt-1" [deal]="deal()" />
    </div>

    @if (company(); as c) {
      <div class="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
        <ui-avatar [name]="c" size="xs" [square]="true" />
        <span class="truncate">{{ c }}</span>
      </div>
    }

    <div class="mt-3 flex items-center justify-between gap-2">
      <span class="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg tabular">{{ deal().value | money }}</span>
      <app-owner [ownerId]="deal().ownerId" [showName]="false" size="sm" />
    </div>

    <div class="mt-2.5 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
      @if (closed()) {
        <span class="inline-flex items-center gap-1 text-xs text-fg-muted">
          <svg lucideIcon="calendar-check" [size]="12" aria-hidden="true"></svg>
          {{ deal().closedAt | localDate: 'dayMonth' }}
        </span>
      } @else {
        <span class="inline-flex items-center gap-1 text-xs" [class.text-danger]="overdue()" [class.text-fg-muted]="!overdue()">
          <svg [lucideIcon]="overdue() ? 'circle-alert' : 'calendar'" [size]="12" aria-hidden="true"></svg>
          @if (overdue()) {
            {{ 'pipeline.overdue' | translate }} ·
          }
          {{ deal().expectedCloseDate | localDate: 'dayMonth' }}
        </span>
      }
      <app-priority-badge [priority]="deal().priority" />
    </div>

    @if (deal().tags.length > 0) {
      <div class="mt-2 flex flex-wrap gap-1">
        @for (tag of deal().tags; track tag) {
          <span class="ltr-content rounded bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium text-fg-muted">#{{ tag }}</span>
        }
      </div>
    }
  `,
  host: {
    class:
      'deal-card group relative block cursor-grab rounded-xl border border-line bg-surface p-3.5 shadow-xs transition-[box-shadow,border-color,transform] duration-150 hover:border-line-strong hover:shadow-md active:cursor-grabbing',
    '[class.opacity-75]': 'deal().stage === "lost"',
    'data-testid': 'deal-card',
    '[attr.data-deal-id]': 'deal().id',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealCard {
  private readonly companies = inject(CompaniesStore);
  private readonly clock = inject(CLOCK);
  private readonly language = inject(LanguageService);

  readonly deal = input.required<Deal>();

  constructor() {
    // A drag that ends over the card must not also count as a click on its link.
    const drag = inject(CdkDrag, { optional: true, self: true });
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let lastDragEnd = 0;
    const subscription = drag?.ended.subscribe(() => (lastDragEnd = Date.now()));
    const suppress = (event: MouseEvent) => {
      if (Date.now() - lastDragEnd < 350) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    host.addEventListener('click', suppress, true);
    inject(DestroyRef).onDestroy(() => {
      subscription?.unsubscribe();
      host.removeEventListener('click', suppress, true);
    });
  }

  protected readonly company = computed(() => {
    const id = this.deal().companyId;
    return id ? (this.companies.entityMap()[id]?.name ?? null) : null;
  });
  protected readonly closed = computed(() => this.deal().closedAt !== null);
  protected readonly overdue = computed(() => isDealOverdue(this.deal(), this.clock()));
  protected readonly label = computed(() =>
    this.language.t('pipeline.cardLabel', {
      name: this.deal().name,
      company: this.company() ?? '',
      value: formatCurrency(this.deal().value, this.language.locale()),
      stage: this.language.t(`enums.stage.${this.deal().stage}`),
    }),
  );
}
