import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Shimmering placeholder. Size it with utility classes: `<ui-skeleton class="h-4 w-24" />`. */
@Component({
  selector: 'ui-skeleton',
  template: '',
  host: { class: 'skeleton block', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {}
