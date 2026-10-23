import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { regionName } from '../../core/i18n/locale.utils';
import { Company, COMPANY_SIZES, CompanySize, fullName, Industry, INDUSTRIES } from '../../core/models';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { FieldAria } from '../../shared/directives/field-aria';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { FormFieldShell } from '../../shared/ui/form-field';
import { CompanyDraft, CrmService } from '../../state/crm.service';
import { CompaniesStore, TeamStore } from '../../state/entity-stores';

export interface CompanyFormData {
  company?: Company;
  defaults?: Partial<CompanyDraft>;
}

interface CompanyFormModel {
  name: string;
  website: string;
  industry: Industry;
  size: CompanySize;
  city: string;
  countryCode: string;
  ownerId: string;
  description: string;
}

/** Countries offered in the form; names are localized with Intl.DisplayNames. */
const COUNTRY_CODES = [
  'AE', 'AU', 'BR', 'CA', 'CH', 'DE', 'DK', 'EG', 'ES', 'FR', 'GB', 'IE', 'IN', 'IT', 'JP',
  'KW', 'MA', 'NL', 'NO', 'QA', 'SA', 'SE', 'SG', 'US', 'ZA',
];

const URL_PATTERN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

@Component({
  selector: 'app-company-form-dialog',
  imports: [DialogFrame, FormField, FieldAria, FormFieldShell, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'companies.editTitle' : 'companies.newTitle') | translate"
        [description]="(isEdit ? 'companies.editDescription' : 'companies.newDescription') | translate"
        icon="building"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-form-field for="company-name" [label]="'companies.fields.name' | translate" [field]="companyForm.name">
            <input id="company-name" class="control" [formField]="companyForm.name" [placeholder]="'companies.fields.namePlaceholder' | translate" data-testid="company-name" />
          </ui-form-field>
          <ui-form-field for="company-website" [label]="'companies.fields.website' | translate" [field]="companyForm.website" [optional]="'common.optional' | translate">
            <input id="company-website" type="url" dir="ltr" class="control" [formField]="companyForm.website" [placeholder]="'companies.fields.websitePlaceholder' | translate" />
          </ui-form-field>
          <ui-form-field for="company-industry" [label]="'companies.fields.industry' | translate">
            <select id="company-industry" class="control" [formField]="companyForm.industry">
              @for (i of industries; track i) {
                <option [value]="i">{{ 'enums.industry.' + i | translate }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field for="company-size" [label]="'companies.fields.size' | translate">
            <select id="company-size" class="control" [formField]="companyForm.size">
              @for (s of sizes; track s) {
                <option [value]="s">{{ 'enums.companySize.' + s | translate }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field for="company-city" [label]="'companies.fields.city' | translate" [field]="companyForm.city">
            <input id="company-city" class="control" [formField]="companyForm.city" data-testid="company-city" />
          </ui-form-field>
          <ui-form-field for="company-country" [label]="'companies.fields.country' | translate">
            <select id="company-country" class="control" [formField]="companyForm.countryCode">
              @for (c of countries(); track c.code) {
                <option [value]="c.code">{{ c.name }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field class="sm:col-span-2" for="company-owner" [label]="'companies.fields.owner' | translate">
            <select id="company-owner" class="control" [formField]="companyForm.ownerId">
              @for (m of team.members(); track m.id) {
                <option [value]="m.id">{{ name(m) }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field class="sm:col-span-2" for="company-description" [label]="'companies.fields.description' | translate" [optional]="'common.optional' | translate">
            <textarea id="company-description" rows="3" class="control" [formField]="companyForm.description" [placeholder]="'companies.fields.descriptionPlaceholder' | translate"></textarea>
          </ui-form-field>
        </div>

        @if (failed()) {
          <p class="mt-4 text-sm text-danger" role="alert">{{ 'errors.saveFailed' | translate }}</p>
        }

        <ng-container dialogFooter>
          <button ui-button type="button" (click)="ref.close()">{{ 'common.cancel' | translate }}</button>
          <button ui-button type="submit" variant="primary" [loading]="saving()" data-testid="company-submit">
            {{ (isEdit ? 'common.saveChanges' : 'companies.create') | translate }}
          </button>
        </ng-container>
      </ui-dialog-frame>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyFormDialog {
  protected readonly ref = inject<DialogRef<Company>>(DialogRef);
  private readonly data = inject<CompanyFormData>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly crm = inject(CrmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly companies = inject(CompaniesStore);
  protected readonly team = inject(TeamStore);

  protected readonly isEdit = !!this.data.company;
  protected readonly industries = INDUSTRIES;
  protected readonly sizes = COMPANY_SIZES;
  protected readonly name = fullName;
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  /** Set while persisting so uniqueness checks ignore the record being saved. */
  private readonly persisting = signal(false);

  protected readonly countries = computed(() => {
    const locale = this.language.locale();
    const current = this.data.company?.countryCode;
    const codes = current && !COUNTRY_CODES.includes(current) ? [...COUNTRY_CODES, current] : COUNTRY_CODES;
    return codes
      .map((code) => ({ code, name: regionName(code, locale) }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  });

  private readonly model = signal<CompanyFormModel>(this.initialModel());

  protected readonly companyForm = form(this.model, (p) => {
    required(p.name, { message: 'validation.required' });
    validate(p.name, ({ value }) => {
      if (this.persisting()) return undefined;
      const name = value().trim().toLowerCase();
      const selfId = this.data.company?.id;
      const taken = this.companies.entities().some((c) => c.id !== selfId && c.name.toLowerCase() === name);
      return taken ? { kind: 'duplicate', message: 'validation.duplicateCompany' } : undefined;
    });
    validate(p.website, ({ value }) =>
      value().trim() && !URL_PATTERN.test(value().trim()) ? { kind: 'url', message: 'validation.url' } : undefined,
    );
    required(p.city, { message: 'validation.required' });
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.failed.set(false);
    await submit(this.companyForm, async () => {
      this.saving.set(true);
      this.persisting.set(true);
      const m = this.model();
      const website = m.website.trim();
      const draft: CompanyDraft = {
        name: m.name.trim(),
        website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
        industry: m.industry,
        size: m.size,
        city: m.city.trim(),
        countryCode: m.countryCode,
        ownerId: m.ownerId,
        description: m.description.trim(),
      };
      try {
        if (this.data.company) {
          const saved = await this.crm.updateCompany(this.data.company.id, draft);
          this.toast.success('companies.updated');
          this.ref.close(saved);
        } else {
          const saved = await this.crm.createCompany(draft);
          this.toast.success('companies.created', undefined, {
            label: 'common.view',
            run: () => void this.router.navigate(['/companies', saved.id]),
          });
          this.ref.close(saved);
        }
      } catch {
        this.persisting.set(false);
        this.failed.set(true);
      } finally {
        this.saving.set(false);
      }
    });
  }

  private initialModel(): CompanyFormModel {
    const c = this.data.company;
    const d = this.data.defaults ?? {};
    return {
      name: c?.name ?? d.name ?? '',
      website: c?.website ?? d.website ?? '',
      industry: c?.industry ?? d.industry ?? 'software',
      size: c?.size ?? d.size ?? '51-200',
      city: c?.city ?? d.city ?? '',
      countryCode: c?.countryCode ?? d.countryCode ?? 'US',
      ownerId: c?.ownerId ?? d.ownerId ?? CURRENT_USER_ID,
      description: c?.description ?? d.description ?? '',
    };
  }
}
