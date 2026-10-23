import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { DealStage, OPEN_STAGES, OpenStage } from '../../core/models';

/** Clickable stage progression: open stages in order, then the outcome. */
@Component({
  selector: 'app-deal-stage-stepper',
  imports: [LucideDynamicIcon, TranslatePipe],
  template: `
    <ol class="flex min-w-max items-stretch gap-1.5" [attr.aria-label]="'deals.stageProgress' | translate">
      @for (step of steps(); track step.stage; let i = $index) {
        <li class="flex-1">
          <button
            type="button"
            class="step group flex h-10 w-full min-w-28 items-center justify-center gap-1.5 px-4 text-[0.8125rem] font-medium transition-colors"
            [class]="step.className"
            [attr.aria-current]="step.current ? 'step' : null"
            [attr.aria-label]="step.current ? ('deals.currentStage' | translate) + ': ' + ('enums.stage.' + step.stage | translate) : ('pipeline.moveToStage' | translate: { stage: ('enums.stage.' + step.stage | translate) })"
            (click)="!step.current && changed.emit(step.stage)"
            [attr.data-testid]="'stepper-' + step.stage"
          >
            @if (step.done) {
              <svg lucideIcon="check" [size]="14" aria-hidden="true"></svg>
            }
            {{ 'enums.stage.' + step.stage | translate }}
          </button>
        </li>
      }
      <li class="flex-1">
        <button
          type="button"
          class="step flex h-10 w-full min-w-28 items-center justify-center gap-1.5 px-4 text-[0.8125rem] font-medium transition-colors"
          [class]="stage() === 'won' ? 'bg-success text-white' : 'bg-surface-sunken text-fg-muted hover:bg-success-soft hover:text-success-soft-fg'"
          [attr.aria-current]="stage() === 'won' ? 'step' : null"
          (click)="stage() !== 'won' && changed.emit('won')"
          data-testid="stepper-won"
        >
          <svg lucideIcon="trophy" [size]="14" aria-hidden="true"></svg>{{ 'enums.stage.won' | translate }}
        </button>
      </li>
      <li class="flex-1">
        <button
          type="button"
          class="step flex h-10 w-full min-w-28 items-center justify-center gap-1.5 px-4 text-[0.8125rem] font-medium transition-colors"
          [class]="stage() === 'lost' ? 'bg-danger text-white' : 'bg-surface-sunken text-fg-muted hover:bg-danger-soft hover:text-danger-soft-fg'"
          [attr.aria-current]="stage() === 'lost' ? 'step' : null"
          (click)="stage() !== 'lost' && changed.emit('lost')"
          data-testid="stepper-lost"
        >
          <svg lucideIcon="circle-x" [size]="14" aria-hidden="true"></svg>{{ 'enums.stage.lost' | translate }}
        </button>
      </li>
    </ol>
  `,
  styles: `
    .step {
      clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
    }
    li:first-child .step {
      clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
      border-start-start-radius: 0.5rem;
      border-end-start-radius: 0.5rem;
    }
    li:last-child .step {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%);
      border-start-end-radius: 0.5rem;
      border-end-end-radius: 0.5rem;
    }
    :host-context([dir='rtl']) .step {
      clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 10px 100%, 0 50%);
    }
    :host-context([dir='rtl']) li:first-child .step {
      clip-path: polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 50%);
    }
    :host-context([dir='rtl']) li:last-child .step {
      clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%);
    }
  `,
  host: { class: 'block overflow-x-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealStageStepper {
  readonly stage = input.required<DealStage>();
  readonly lostAtStage = input<OpenStage | null>(null);
  readonly changed = output<DealStage>();

  protected readonly steps = computed(() => {
    const stage = this.stage();
    const reached =
      stage === 'won' ? OPEN_STAGES.length : stage === 'lost' ? OPEN_STAGES.indexOf(this.lostAtStage() ?? 'new') : OPEN_STAGES.indexOf(stage);
    return OPEN_STAGES.map((s, i) => {
      const current = s === stage;
      // A lost deal reached (and passed) every stage up to the one it was lost at.
      const done = i < reached || ((stage === 'won' || stage === 'lost') && i <= reached);
      return {
        stage: s,
        current,
        done: done && !current,
        className: current
          ? 'bg-primary text-primary-fg'
          : done
            ? 'bg-primary-soft text-primary-soft-fg hover:bg-primary-border/60'
            : 'bg-surface-sunken text-fg-muted hover:bg-surface-active hover:text-fg',
      };
    });
  });
}
