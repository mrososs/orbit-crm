import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { Activity, ACTIVITY_TYPES, ActivityType, fullName, isOpenStage, Priority, PRIORITIES } from '../../core/models';
import { CLOCK } from '../../core/services/platform';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { FieldAria } from '../../shared/directives/field-aria';
import { ACTIVITY_ICON } from '../../shared/domain/domain-badges';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { FormFieldShell } from '../../shared/ui/form-field';
import { LucideDynamicIcon } from '@lucide/angular';
import { addDays, toIsoDate } from '../../shared/utils/date';
import { ActivityDraft, CrmService } from '../../state/crm.service';
import { ContactsStore, DealsStore, TeamStore } from '../../state/entity-stores';

export interface ActivityFormData {
  activity?: Activity;
  defaults?: Partial<ActivityDraft>;
}

interface ActivityFormModel {
  type: ActivityType;
  subject: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: Priority;
  ownerId: string;
  contactId: string;
  dealId: string;
}

@Component({
  selector: 'app-activity-form-dialog',
  imports: [DialogFrame, FormField, FieldAria, FormFieldShell, Button, TranslatePipe, LucideDynamicIcon],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'activities.editTitle' : 'activities.newTitle') | translate"
        [description]="(isEdit ? 'activities.editDescription' : 'activities.newDescription') | translate"
        icon="calendar-check"
      >
        <fieldset class="mb-4">
          <legend class="label">{{ 'activities.fields.type' | translate }}</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (t of types; track t) {
              <label
                class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[0.8125rem] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
                [class]="model().type === t ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'"
              >
                <input type="radio" class="sr-only" [value]="t" [formField]="activityForm.type" />
                <svg [lucideIcon]="icon[t]" [size]="15" aria-hidden="true"></svg>
                {{ 'enums.activityType.' + t | translate }}
              </label>
            }
          </div>
        </fieldset>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-form-field class="sm:col-span-2" for="activity-subject" [label]="'activities.fields.subject' | translate" [field]="activityForm.subject">
            <input id="activity-subject" class="control" [formField]="activityForm.subject" [placeholder]="'activities.fields.subjectPlaceholder' | translate" data-testid="activity-subject" />
          </ui-form-field>

          <ui-form-field for="activity-date" [label]="'activities.fields.dueDate' | translate" [field]="activityForm.dueDate">
            <input id="activity-date" type="date" class="control" [formField]="activityForm.dueDate" data-testid="activity-date" />
          </ui-form-field>

          <ui-form-field for="activity-time" [label]="'activities.fields.dueTime' | translate" [field]="activityForm.dueTime">
            <input id="activity-time" type="time" class="control tabular" [formField]="activityForm.dueTime" />
          </ui-form-field>

          <ui-form-field for="activity-priority" [label]="'activities.fields.priority' | translate">
            <select id="activity-priority" class="control" [formField]="activityForm.priority">
              @for (p of priorities; track p) {
                <option [value]="p">{{ 'enums.priority.' + p | translate }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="activity-owner" [label]="'activities.fields.owner' | translate" [field]="activityForm.ownerId">
            <select id="activity-owner" class="control" [formField]="activityForm.ownerId">
              @for (m of team.members(); track m.id) {
                <option [value]="m.id">{{ name(m) }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="activity-contact" [label]="'activities.fields.contact' | translate" [optional]="'common.optional' | translate">
            <select id="activity-contact" class="control" [formField]="activityForm.contactId">
              <option value="">{{ 'activities.fields.noContact' | translate }}</option>
              @for (c of contactOptions(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="activity-deal" [label]="'activities.fields.deal' | translate" [optional]="'common.optional' | translate">
            <select id="activity-deal" class="control" [formField]="activityForm.dealId">
              <option value="">{{ 'activities.fields.noDeal' | translate }}</option>
              @for (d of dealOptions(); track d.id) {
                <option [value]="d.id">{{ d.name }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field class="sm:col-span-2" for="activity-description" [label]="'activities.fields.description' | translate" [optional]="'common.optional' | translate">
            <textarea id="activity-description" rows="3" class="control" [formField]="activityForm.description" [placeholder]="'activities.fields.descriptionPlaceholder' | translate"></textarea>
          </ui-form-field>
        </div>

        @if (failed()) {
          <p class="mt-4 text-sm text-danger" role="alert">{{ 'errors.saveFailed' | translate }}</p>
        }

        <ng-container dialogFooter>
          <button ui-button type="button" (click)="ref.close()">{{ 'common.cancel' | translate }}</button>
          <button ui-button type="submit" variant="primary" [loading]="saving()" data-testid="activity-submit">
            {{ (isEdit ? 'common.saveChanges' : 'activities.create') | translate }}
          </button>
        </ng-container>
      </ui-dialog-frame>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFormDialog {
  protected readonly ref = inject<DialogRef<Activity>>(DialogRef);
  private readonly data = inject<ActivityFormData>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly crm = inject(CrmService);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(CLOCK);
  protected readonly team = inject(TeamStore);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);

  protected readonly isEdit = !!this.data.activity;
  protected readonly types = ACTIVITY_TYPES;
  protected readonly priorities = PRIORITIES;
  protected readonly icon = ACTIVITY_ICON;
  protected readonly name = fullName;
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  protected readonly model = signal<ActivityFormModel>(this.initialModel());

  protected readonly activityForm = form(this.model, (p) => {
    required(p.subject, { message: 'validation.required' });
    minLength(p.subject, 3);
    required(p.dueDate, { message: 'validation.required' });
    required(p.dueTime, { message: 'validation.required' });
    required(p.ownerId, { message: 'validation.required' });
  });

  protected readonly contactOptions = computed(() =>
    this.contacts.sorted().map((c) => ({ id: c.id, name: fullName(c) })),
  );

  protected readonly dealOptions = computed(() => {
    const current = this.model().dealId;
    return this.deals
      .entities()
      .filter((d) => isOpenStage(d.stage) || d.id === current)
      .map((d) => ({ id: d.id, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    // Picking a deal pre-fills its primary contact when none is selected.
    effect(() => {
      const dealId = this.model().dealId;
      untracked(() => {
        const deal = dealId ? this.deals.entityMap()[dealId] : undefined;
        if (deal?.contactId && !this.model().contactId) {
          this.model.update((m) => ({ ...m, contactId: deal.contactId! }));
        }
      });
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.failed.set(false);
    await submit(this.activityForm, async () => {
      this.saving.set(true);
      const m = this.model();
      const draft: ActivityDraft = {
        type: m.type,
        subject: m.subject.trim(),
        description: m.description.trim(),
        dueAt: new Date(`${m.dueDate}T${m.dueTime}:00`).toISOString(),
        priority: m.priority,
        ownerId: m.ownerId,
        contactId: m.contactId || null,
        dealId: m.dealId || null,
      };
      try {
        const saved = this.data.activity
          ? await this.crm.updateActivity(this.data.activity.id, draft)
          : await this.crm.createActivity(draft);
        this.toast.success(this.data.activity ? 'activities.updated' : 'activities.created');
        this.ref.close(saved);
      } catch {
        this.failed.set(true);
      } finally {
        this.saving.set(false);
      }
    });
  }

  private initialModel(): ActivityFormModel {
    const a = this.data.activity;
    if (a) {
      const due = new Date(a.dueAt);
      return {
        type: a.type,
        subject: a.subject,
        description: a.description,
        dueDate: toIsoDate(due),
        dueTime: `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`,
        priority: a.priority,
        ownerId: a.ownerId,
        contactId: a.contactId ?? '',
        dealId: a.dealId ?? '',
      };
    }
    const d = this.data.defaults ?? {};
    return {
      type: d.type ?? 'follow-up',
      subject: d.subject ?? '',
      description: d.description ?? '',
      dueDate: toIsoDate(addDays(this.clock(), 1)),
      dueTime: '10:00',
      priority: d.priority ?? 'medium',
      ownerId: d.ownerId ?? CURRENT_USER_ID,
      contactId: d.contactId ?? '',
      dealId: d.dealId ?? '',
    };
  }
}
