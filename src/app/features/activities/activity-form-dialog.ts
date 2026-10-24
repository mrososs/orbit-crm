import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { TranslatePipe } from '@ngx-translate/core';
import { Activity, ACTIVITY_TYPES, ActivityType, fullName, isOpenStage, Priority, PRIORITIES } from '../../core/models';
import { LanguageService } from '../../core/i18n/language.service';
import { CLOCK } from '../../core/services/platform';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { FieldAria } from '../../shared/directives/field-aria';
import { ACTIVITY_ICON } from '../../shared/domain/domain-badges';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { Combobox } from '../../shared/ui/controls/combobox';
import { DatePicker } from '../../shared/ui/controls/date-picker';
import { Select } from '../../shared/ui/controls/select';
import { TextInput } from '../../shared/ui/controls/text-input';
import { Textarea } from '../../shared/ui/controls/textarea';
import { LucideDynamicIcon } from '@lucide/angular';
import { addDays, toIsoDate } from '../../shared/utils/date';
import { ActivityDraft, CrmService } from '../../state/crm.service';
import { CompaniesStore, ContactsStore, DealsStore, TeamStore } from '../../state/entity-stores';

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
  imports: [DialogFrame, FormField, FieldAria, TextInput, Select, Combobox, DatePicker, Textarea, Button, TranslatePipe, LucideDynamicIcon],
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
          <ui-text-input class="sm:col-span-2" inputId="activity-subject" testId="activity-subject" [label]="'activities.fields.subject' | translate" [placeholder]="'activities.fields.subjectPlaceholder' | translate" [formField]="activityForm.subject" />
          <ui-date-picker inputId="activity-date" testId="activity-date" shortcuts [label]="'activities.fields.dueDate' | translate" [formField]="activityForm.dueDate" />
          <ui-date-picker inputId="activity-time" type="time" [label]="'activities.fields.dueTime' | translate" [formField]="activityForm.dueTime" />
          <ui-select inputId="activity-priority" [label]="'activities.fields.priority' | translate" [options]="priorityOptions()" [formField]="activityForm.priority" />
          <ui-select inputId="activity-owner" [label]="'activities.fields.owner' | translate" [options]="ownerOptions()" [formField]="activityForm.ownerId" />
          <ui-combobox inputId="activity-contact" testId="activity-contact" optional clearable [label]="'activities.fields.contact' | translate" [placeholder]="'activities.fields.noContact' | translate" [options]="contactOptions()" [formField]="activityForm.contactId" />
          <ui-combobox inputId="activity-deal" testId="activity-deal" optional clearable [label]="'activities.fields.deal' | translate" [placeholder]="'activities.fields.noDeal' | translate" [options]="dealOptions()" [formField]="activityForm.dealId" />
          <ui-textarea class="sm:col-span-2" inputId="activity-description" optional [label]="'activities.fields.description' | translate" [placeholder]="'activities.fields.descriptionPlaceholder' | translate" [formField]="activityForm.description" />
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
  private readonly language = inject(LanguageService);
  private readonly team = inject(TeamStore);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);
  private readonly companies = inject(CompaniesStore);

  protected readonly isEdit = !!this.data.activity;
  protected readonly types = ACTIVITY_TYPES;
  protected readonly icon = ACTIVITY_ICON;

  protected readonly priorityOptions = computed(() =>
    PRIORITIES.map((p) => ({ value: p, label: this.language.t(`enums.priority.${p}`) })),
  );
  protected readonly ownerOptions = computed(() => this.team.members().map((m) => ({ value: m.id, label: fullName(m) })));
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

  protected readonly contactOptions = computed(() => {
    const companies = this.companies.entityMap();
    return this.contacts.sorted().map((c) => {
      const company = (c.companyId && companies[c.companyId]?.name) || '';
      return { value: c.id, label: fullName(c), description: company || c.email, keywords: `${company} ${c.email}` };
    });
  });

  protected readonly dealOptions = computed(() => {
    const current = this.model().dealId;
    return this.deals
      .entities()
      .filter((d) => isOpenStage(d.stage) || d.id === current)
      .map((d) => ({ value: d.id, label: d.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
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
