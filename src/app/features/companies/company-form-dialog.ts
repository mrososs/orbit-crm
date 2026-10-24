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
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { Combobox } from '../../shared/ui/controls/combobox';
import { Select } from '../../shared/ui/controls/select';
import { TextInput } from '../../shared/ui/controls/text-input';
import { Textarea } from '../../shared/ui/controls/textarea';
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
  imports: [DialogFrame, FormField, TextInput, Select, Combobox, Textarea, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'companies.editTitle' : 'companies.newTitle') | translate"
        [description]="(isEdit ? 'companies.editDescription' : 'companies.newDescription') | translate"
        icon="building"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-text-input inputId="company-name" testId="company-name" [label]="'companies.fields.name' | translate" [placeholder]="'companies.fields.namePlaceholder' | translate" [formField]="companyForm.name" />
          <ui-text-input inputId="company-website" type="url" optional [label]="'companies.fields.website' | translate" [placeholder]="'companies.fields.websitePlaceholder' | translate" [formField]="companyForm.website" />
          <ui-select inputId="company-industry" [label]="'companies.fields.industry' | translate" [options]="industryOptions()" [formField]="companyForm.industry" />
          <ui-select inputId="company-size" [label]="'companies.fields.size' | translate" [options]="sizeOptions()" [formField]="companyForm.size" />
          <ui-text-input inputId="company-city" testId="company-city" [label]="'companies.fields.city' | translate" [formField]="companyForm.city" />
          <ui-combobox inputId="company-country" [label]="'companies.fields.country' | translate" [options]="countries()" [formField]="companyForm.countryCode" />
          <ui-select class="sm:col-span-2" inputId="company-owner" [label]="'companies.fields.owner' | translate" [options]="ownerOptions()" [formField]="companyForm.ownerId" />
          <ui-textarea class="sm:col-span-2" inputId="company-description" optional [label]="'companies.fields.description' | translate" [placeholder]="'companies.fields.descriptionPlaceholder' | translate" [formField]="companyForm.description" />
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
  private readonly team = inject(TeamStore);

  protected readonly isEdit = !!this.data.company;

  protected readonly industryOptions = computed(() =>
    INDUSTRIES.map((i) => ({ value: i, label: this.language.t(`enums.industry.${i}`) })),
  );
  protected readonly sizeOptions = computed(() =>
    COMPANY_SIZES.map((s) => ({ value: s, label: this.language.t(`enums.companySize.${s}`) })),
  );
  protected readonly ownerOptions = computed(() => this.team.members().map((m) => ({ value: m.id, label: fullName(m) })));
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  /** Set while persisting so uniqueness checks ignore the record being saved. */
  private readonly persisting = signal(false);

  protected readonly countries = computed(() => {
    const locale = this.language.locale();
    const current = this.data.company?.countryCode;
    const codes = current && !COUNTRY_CODES.includes(current) ? [...COUNTRY_CODES, current] : COUNTRY_CODES;
    return codes
      .map((code) => ({ value: code, label: regionName(code, locale) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
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
