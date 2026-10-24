import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField, min, minLength, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { normalizeTags } from '../../core/domain/deal-rules';
import {
  Deal,
  DEAL_STAGES,
  DealStage,
  fullName,
  LEAD_SOURCES,
  LeadSource,
  Priority,
  PRIORITIES,
  WORKSPACE_CURRENCY,
} from '../../core/models';
import { LanguageService } from '../../core/i18n/language.service';
import { CLOCK } from '../../core/services/platform';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { Combobox } from '../../shared/ui/controls/combobox';
import { CurrencyInput } from '../../shared/ui/controls/currency-input';
import { DatePicker } from '../../shared/ui/controls/date-picker';
import { Select } from '../../shared/ui/controls/select';
import { TextInput } from '../../shared/ui/controls/text-input';
import { Textarea } from '../../shared/ui/controls/textarea';
import { addDays, toIsoDate } from '../../shared/utils/date';
import { CrmService, DealDraft } from '../../state/crm.service';
import { CompaniesStore, ContactsStore, TeamStore } from '../../state/entity-stores';

export interface DealFormData {
  deal?: Deal;
  defaults?: Partial<DealDraft>;
}

interface DealFormModel {
  name: string;
  companyId: string;
  contactId: string;
  value: number;
  stage: DealStage;
  priority: Priority;
  ownerId: string;
  source: LeadSource;
  expectedCloseDate: string;
  tags: string;
  notes: string;
}

@Component({
  selector: 'app-deal-form-dialog',
  imports: [DialogFrame, FormField, TextInput, Select, Combobox, CurrencyInput, DatePicker, Textarea, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'deals.editTitle' : 'deals.newTitle') | translate"
        [description]="(isEdit ? 'deals.editDescription' : 'deals.newDescription') | translate"
        icon="briefcase"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-text-input class="sm:col-span-2" inputId="deal-name" testId="deal-name" [label]="'deals.fields.name' | translate" [placeholder]="'deals.fields.namePlaceholder' | translate" [formField]="dealForm.name" />
          <ui-combobox inputId="deal-company" testId="deal-company" [label]="'deals.fields.company' | translate" [placeholder]="'deals.fields.companyPlaceholder' | translate" [options]="companyOptions()" [formField]="dealForm.companyId" />
          <ui-select inputId="deal-contact" optional [label]="'deals.fields.contact' | translate" [placeholder]="'deals.fields.noContact' | translate" [options]="companyContacts()" [formField]="dealForm.contactId" />
          <ui-currency-input inputId="deal-value" testId="deal-value" [label]="('deals.fields.value' | translate) + ' (' + currency + ')'" [formField]="dealForm.value" />
          <ui-date-picker inputId="deal-close" testId="deal-close" [label]="'deals.fields.closeDate' | translate" [formField]="dealForm.expectedCloseDate" />
          <ui-select inputId="deal-stage" testId="deal-stage" [label]="'deals.fields.stage' | translate" [options]="stageOptions()" [formField]="dealForm.stage" />
          <ui-select inputId="deal-priority" [label]="'deals.fields.priority' | translate" [options]="priorityOptions()" [formField]="dealForm.priority" />
          <ui-select inputId="deal-owner" [label]="'deals.fields.owner' | translate" [options]="ownerOptions()" [formField]="dealForm.ownerId" />
          <ui-select inputId="deal-source" [label]="'deals.fields.source' | translate" [options]="sourceOptions()" [formField]="dealForm.source" />
          <ui-text-input class="sm:col-span-2" inputId="deal-tags" optional [label]="'deals.fields.tags' | translate" [hint]="'deals.fields.tagsHint' | translate" [placeholder]="'deals.fields.tagsPlaceholder' | translate" [formField]="dealForm.tags" />
          <ui-textarea class="sm:col-span-2" inputId="deal-notes" optional [label]="'deals.fields.notes' | translate" [placeholder]="'deals.fields.notesPlaceholder' | translate" [formField]="dealForm.notes" />
        </div>

        @if (failed()) {
          <p class="mt-4 text-sm text-danger" role="alert">{{ 'errors.saveFailed' | translate }}</p>
        }

        <ng-container dialogFooter>
          <button ui-button type="button" (click)="ref.close()">{{ 'common.cancel' | translate }}</button>
          <button ui-button type="submit" variant="primary" [loading]="saving()" data-testid="deal-submit">
            {{ (isEdit ? 'common.saveChanges' : 'deals.create') | translate }}
          </button>
        </ng-container>
      </ui-dialog-frame>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealFormDialog {
  protected readonly ref = inject<DialogRef<Deal>>(DialogRef);
  private readonly data = inject<DealFormData>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly crm = inject(CrmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly clock = inject(CLOCK);
  private readonly language = inject(LanguageService);
  private readonly companies = inject(CompaniesStore);
  private readonly team = inject(TeamStore);
  private readonly contacts = inject(ContactsStore);

  protected readonly isEdit = !!this.data.deal;
  protected readonly currency = WORKSPACE_CURRENCY;

  protected readonly companyOptions = computed(() => this.companies.sorted().map((c) => ({ value: c.id, label: c.name, description: c.city, keywords: c.city })));
  protected readonly stageOptions = computed(() => DEAL_STAGES.map((s) => ({ value: s, label: this.language.t(`enums.stage.${s}`) })));
  protected readonly priorityOptions = computed(() =>
    PRIORITIES.map((p) => ({ value: p, label: this.language.t(`enums.priority.${p}`) })),
  );
  protected readonly sourceOptions = computed(() => LEAD_SOURCES.map((s) => ({ value: s, label: this.language.t(`enums.source.${s}`) })));
  protected readonly ownerOptions = computed(() => this.team.members().map((m) => ({ value: m.id, label: fullName(m) })));
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  private readonly model = signal<DealFormModel>(this.initialModel());

  protected readonly dealForm = form(this.model, (p) => {
    required(p.name, { message: 'validation.required' });
    minLength(p.name, 3);
    required(p.companyId, { message: 'validation.required' });
    required(p.ownerId, { message: 'validation.required' });
    required(p.expectedCloseDate, { message: 'validation.required' });
    min(p.value, 1, { message: 'validation.positive' });
  });

  protected readonly companyContacts = computed(() => {
    const companyId = this.model().companyId;
    return (this.contacts.byCompany().get(companyId) ?? [])
      .map((c) => ({ value: c.id, label: fullName(c) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  constructor() {
    // Keep the contact consistent with the chosen company.
    effect(() => {
      const options = this.companyContacts();
      untracked(() => {
        const contactId = this.model().contactId;
        if (contactId && !options.some((o) => o.value === contactId)) {
          this.model.update((m) => ({ ...m, contactId: '' }));
        }
      });
    });
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.failed.set(false);
    await submit(this.dealForm, async () => {
      this.saving.set(true);
      const m = this.model();
      const draft: DealDraft = {
        name: m.name.trim(),
        companyId: m.companyId || null,
        contactId: m.contactId || null,
        value: Number(m.value),
        stage: m.stage,
        priority: m.priority,
        ownerId: m.ownerId,
        source: m.source,
        expectedCloseDate: m.expectedCloseDate,
        tags: normalizeTags(m.tags),
        notes: m.notes.trim(),
      };
      try {
        if (this.data.deal) {
          const saved = await this.crm.updateDeal(this.data.deal.id, draft);
          this.toast.success('deals.updated');
          this.ref.close(saved);
        } else {
          const saved = await this.crm.createDeal(draft);
          this.toast.success('deals.created', undefined, {
            label: 'common.view',
            run: () => void this.router.navigate(['/deals', saved.id]),
          });
          this.ref.close(saved);
        }
      } catch {
        this.failed.set(true);
      } finally {
        this.saving.set(false);
      }
    });
  }

  private initialModel(): DealFormModel {
    const d = this.data.deal;
    const defaults = this.data.defaults ?? {};
    if (d) {
      return {
        name: d.name,
        companyId: d.companyId ?? '',
        contactId: d.contactId ?? '',
        value: d.value,
        stage: d.stage,
        priority: d.priority,
        ownerId: d.ownerId,
        source: d.source,
        expectedCloseDate: d.expectedCloseDate,
        tags: d.tags.join(', '),
        notes: d.notes,
      };
    }
    return {
      name: defaults.name ?? '',
      companyId: defaults.companyId ?? '',
      contactId: defaults.contactId ?? '',
      value: defaults.value ?? 0,
      stage: defaults.stage ?? 'new',
      priority: defaults.priority ?? 'medium',
      ownerId: defaults.ownerId ?? CURRENT_USER_ID,
      source: defaults.source ?? 'website',
      expectedCloseDate: defaults.expectedCloseDate ?? toIsoDate(addDays(this.clock(), 30)),
      tags: (defaults.tags ?? []).join(', '),
      notes: defaults.notes ?? '',
    };
  }
}
