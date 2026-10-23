import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-not-found-page',
  imports: [EmptyState, RouterLink, TranslatePipe],
  template: `
    <div class="page">
      <ui-empty-state
        class="card mt-10"
        icon="search-x"
        [headingLevel]="1"
        [heading]="'notFound.title' | translate"
        [description]="'notFound.description' | translate"
      >
        <a routerLink="/dashboard" class="btn btn-primary">{{ 'notFound.back' | translate }}</a>
      </ui-empty-state>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
