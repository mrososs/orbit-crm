import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Orbit CRM mark: a core with an orbiting satellite. */
@Component({
  selector: 'app-logo',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <circle cx="16" cy="16" r="5" fill="var(--primary-fg)" />
      <ellipse
        cx="16"
        cy="16"
        rx="11"
        ry="5.2"
        stroke="var(--primary-fg)"
        stroke-opacity=".5"
        stroke-width="1.6"
        transform="rotate(-28 16 16)"
      />
      <circle cx="25.2" cy="11.4" r="1.9" fill="var(--primary-fg)" fill-opacity=".85" />
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly size = input(28);
}
