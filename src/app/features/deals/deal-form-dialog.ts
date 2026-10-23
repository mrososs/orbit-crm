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
import { CLOCK } from '../../core/services/platform';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { FieldAria } from '../../shared/directives/field-aria';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { FormFieldShell } from '../../shared/ui/form-field';
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
  imports: [DialogFrame, FormField, FieldAria, FormFieldShell, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'deals.editTitle' : 'deals.newTitle') | translate"
        [description]="(isEdit ? 'deals.editDescription' : 'deals.newDescription') | translate"
        icon="briefcase"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-form-field class="sm:col-span-2" for="deal-name" [label]="'deals.fields.name' | translate" [field]="dealForm.name">
            <input id="deal-name" class="control" [formField]="dealForm.name" [placeholder]="'deals.fields.namePlaceholder' | translate" data-testid="deal-name" />
          </ui-form-field>

          <ui-form-field for="deal-company" [label]="'deals.fields.company' | translate" [field]="dealForm.companyId">
            <select id="deal-company" class="control" [formField]="dealForm.companyId" data-testid="deal-company">
              <option value="">{{ 'deals.fields.companyPlaceholder' | translate }}</option>
              @for (c of companies.sorted(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="deal-contact" [label]="'deals.fields.contact' | translate" [optional]="'common.optional' | translate">
            <select id="deal-contact" class="control" [formField]="dealForm.contactId">
              <option value="">{{ 'deals.fields.noContact' | translate }}</option>
              @for (c of companyContacts(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="deal-value" [label]="('deals.fields.value' | translate) + ' (' + currency + ')'" [field]="dealForm.value">
            <input id="deal-value" type="number" inputmode="decimal" step="500" class="control tabular" [formField]="dealForm.value" data-testid="deal-value" />
          </ui-form-field>

          <ui-form-field for="deal-close" [label]="'deals.fields.closeDate' | translate" [field]="dealForm.expectedCloseDate">
            <input id="deal-close" type="date" class="control" [formField]="dealForm.expectedCloseDate" />
          </ui-form-field>

          <ui-form-field for="deal-stage" [label]="'deals.fields.stage' | translate">
            <select id="deal-stage" class="control" [formField]="dealForm.stage" data-testid="deal-stage">
              @for (s of stages; track s) {
                <option [value]="s">{{ 'enums.stage.' + s | translate }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="deal-priority" [label]="'deals.fields.priority' | translate">
            <select id="deal-priority" class="control" [formField]="dealForm.priority">
              @for (p of priorities; track p) {
                <option [value]="p">{{ 'enums.priority.' + p | translate }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="deal-owner" [label]="'deals.fields.owner' | translate" [field]="dealForm.ownerId">
            <select id="deal-owner" class="control" [formField]="dealForm.ownerId">
              @for (m of team.members(); track m.id) {
                <option [value]="m.id">{{ name(m) }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field for="deal-source" [label]="'deals.fields.source' | translate">
            <select id="deal-source" class="control" [formField]="dealForm.source">
              @for (s of sources; track s) {
                <option [value]="s">{{ 'enums.source.' + s | translate }}</option>
              }
            </select>
          </ui-form-field>

          <ui-form-field
            class="sm:col-span-2"
            for="deal-tags"
            [label]="'deals.fields.tags' | translate"
            [hint]="'deals.fields.tagsHint' | translate"
            [optional]="'common.optional' | translate"
          >
            <input id="deal-tags" class="control" [formField]="dealForm.tags" [placeholder]="'deals.fields.tagsPlaceholder' | translate" />
          </ui-form-field>

          <ui-form-field class="sm:col-span-2" for="deal-notes" [label]="'deals.fields.notes' | translate" [optional]="'common.optional' | translate">
            <textarea id="deal-notes" rows="3" class="control" [formField]="dealForm.notes" [placeholder]="'deals.fields.notesPlaceholder' | translate"></textarea>
          </ui-form-field>
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
  protected readonly companies = inject(CompaniesStore);
  protected readonly team = inject(TeamStore);
  private readonly contacts = inject(ContactsStore);

  protected readonly isEdit = !!this.data.deal;
  protected readonly stages = DEAL_STAGES;
  protected readonly priorities = PRIORITIES;
  protected readonly sources = LEAD_SOURCES;
  protected readonly currency = WORKSPACE_CURRENCY;
  protected readonly name = fullName;
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
      .map((c) => ({ id: c.id, name: fullName(c) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    // Keep the contact consistent with the chosen company.
    effect(() => {
      const options = this.companyContacts();
      untracked(() => {
        const contactId = this.model().contactId;
        if (contactId && !options.some((o) => o.id === contactId)) {
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
