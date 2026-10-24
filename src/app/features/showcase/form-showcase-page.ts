import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  disabled,
  email,
  form,
  FormField,
  max,
  maxLength,
  min,
  minLength,
  readonly,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { CLOCK } from '../../core/services/platform';
import { ToastService } from '../../core/services/toast.service';
import { Button } from '../../shared/ui/button';
import { Checkbox, Toggle } from '../../shared/ui/controls/checkbox';
import { Combobox } from '../../shared/ui/controls/combobox';
import { CurrencyInput } from '../../shared/ui/controls/currency-input';
import { DatePicker } from '../../shared/ui/controls/date-picker';
import { NumberInput } from '../../shared/ui/controls/number-input';
import { Select } from '../../shared/ui/controls/select';
import { TextInput } from '../../shared/ui/controls/text-input';
import { Textarea } from '../../shared/ui/controls/textarea';
import { addDays, toIsoDate } from '../../shared/utils/date';
import { CompaniesStore, ContactsStore } from '../../state/entity-stores';

interface PlaygroundModel {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  seats: number;
  budget: number;
  plan: string;
  companyId: string;
  startDate: string;
  startTime: string;
  notes: string;
  terms: boolean;
  updates: boolean;
}

const PLANS = ['starter', 'growth', 'enterprise'] as const;

/**
 * Internal showcase of the Orbit form controls. Reached from Settings → About
 * and the command palette rather than the primary navigation.
 */
@Component({
  selector: 'app-form-showcase-page',
  imports: [
    FormField,
    TextInput,
    NumberInput,
    CurrencyInput,
    Textarea,
    Select,
    Combobox,
    DatePicker,
    Checkbox,
    Toggle,
    Button,
    TranslatePipe,
    LucideDynamicIcon,
    JsonPipe,
  ],
  template: `
    <div class="page max-w-6xl animate-rise-in">
      <header class="page-header">
        <div>
          <p class="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-soft-fg">
            <svg lucideIcon="component" [size]="14" aria-hidden="true"></svg>{{ 'showcase.eyebrow' | translate }}
          </p>
          <h1 class="page-title">{{ 'showcase.title' | translate }}</h1>
          <p class="page-description max-w-2xl">{{ 'showcase.subtitle' | translate }}</p>
        </div>
      </header>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form class="card p-5 sm:p-6" (submit)="validateForm($event)" novalidate data-testid="showcase-form">
          <h2 class="card-title">{{ 'showcase.playground' | translate }}</h2>
          <p class="card-subtitle mt-1">{{ 'showcase.playgroundHint' | translate }}</p>

          <fieldset class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend class="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{{ 'showcase.sections.text' | translate }}</legend>
            <ui-text-input inputId="sc-name" testId="sc-name" icon="user" autocomplete="name" [label]="'showcase.fields.name' | translate" [formField]="playground.fullName" />
            <ui-text-input inputId="sc-email" testId="sc-email" type="email" icon="mail" autocomplete="email" [label]="'showcase.fields.email' | translate" [formField]="playground.email" />
            <ui-text-input inputId="sc-phone" type="tel" icon="phone" optional [label]="'showcase.fields.phone' | translate" [formField]="playground.phone" />
            <ui-text-input inputId="sc-password" testId="sc-password" type="password" autocomplete="new-password" [label]="'showcase.fields.password' | translate" [hint]="'showcase.fields.passwordHint' | translate" [formField]="playground.password" />
          </fieldset>

          <fieldset class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend class="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{{ 'showcase.sections.numbers' | translate }}</legend>
            <ui-number-input inputId="sc-seats" testId="sc-seats" [unit]="'showcase.fields.seatsUnit' | translate" [label]="'showcase.fields.seats' | translate" [formField]="playground.seats" />
            <ui-currency-input inputId="sc-budget" testId="sc-budget" [label]="'showcase.fields.budget' | translate" [formField]="playground.budget" />
          </fieldset>

          <fieldset class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend class="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{{ 'showcase.sections.choices' | translate }}</legend>
            <ui-select inputId="sc-plan" testId="sc-plan" [label]="'showcase.fields.plan' | translate" [placeholder]="'showcase.fields.planPlaceholder' | translate" [options]="planOptions()" [formField]="playground.plan" />
            <ui-combobox inputId="sc-company" testId="sc-company" clearable [label]="'showcase.fields.company' | translate" [placeholder]="'showcase.fields.companyPlaceholder' | translate" [options]="companyOptions()" [loading]="companies.isLoading()" [formField]="playground.companyId" />
            <ui-date-picker inputId="sc-date" testId="sc-date" shortcuts [minDate]="today()" [label]="'showcase.fields.startDate' | translate" [formField]="playground.startDate" />
            <ui-date-picker inputId="sc-time" type="time" [label]="'showcase.fields.startTime' | translate" [formField]="playground.startTime" />
          </fieldset>

          <fieldset class="mt-6 grid grid-cols-1 gap-4">
            <legend class="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{{ 'showcase.sections.long' | translate }}</legend>
            <ui-textarea inputId="sc-notes" testId="sc-notes" optional [label]="'showcase.fields.notes' | translate" [placeholder]="'showcase.fields.notesPlaceholder' | translate" [formField]="playground.notes" />
            <ui-checkbox inputId="sc-terms" testId="sc-terms" [label]="'showcase.fields.terms' | translate" [description]="'showcase.fields.termsHint' | translate" [formField]="playground.terms" />
            <ui-toggle inputId="sc-updates" testId="sc-updates" [label]="'showcase.fields.updates' | translate" [description]="'showcase.fields.updatesHint' | translate" [formField]="playground.updates" />
          </fieldset>

          <div class="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <button ui-button type="submit" variant="primary" icon="circle-check" data-testid="sc-submit">{{ 'showcase.validate' | translate }}</button>
            <button ui-button type="button" icon="rotate-ccw" (click)="resetForm()" data-testid="sc-reset">{{ 'showcase.reset' | translate }}</button>
            <p class="text-sm" [class]="lastResult() === 'valid' ? 'text-success-soft-fg' : 'text-danger'" role="status" data-testid="sc-result">
              {{ resultMessage() }}
            </p>
          </div>
        </form>

        <aside class="flex flex-col gap-5">
          <section class="card p-5" aria-labelledby="sc-state-title">
            <h2 id="sc-state-title" class="card-title">{{ 'showcase.state' | translate }}</h2>
            <p class="card-subtitle mt-1">{{ 'showcase.stateHint' | translate }}</p>
            <dl class="mt-4 grid grid-cols-2 gap-2 text-xs" data-testid="sc-state">
              @for (flag of flags(); track flag.key) {
                <div class="rounded-lg border border-line-subtle bg-surface-sunken/60 px-2.5 py-2">
                  <dt class="text-fg-muted">{{ 'showcase.flags.' + flag.key | translate }}</dt>
                  <dd class="mt-0.5 font-semibold" [class]="flag.value ? 'text-fg' : 'text-fg-subtle'">{{ (flag.value ? 'showcase.yes' : 'showcase.no') | translate }}</dd>
                </div>
              }
            </dl>
            <p class="mt-4 text-xs font-medium text-fg-muted">{{ 'showcase.value' | translate }}</p>
            <pre class="ltr-content !text-left mt-1.5 max-h-72 overflow-auto rounded-lg border border-line-subtle bg-surface-sunken p-3 text-2xs leading-relaxed text-fg-muted" data-testid="sc-value">{{ model() | json }}</pre>
          </section>
        </aside>
      </div>

      <section class="card mt-5 p-5 sm:p-6" aria-labelledby="sc-states-title" data-testid="showcase-states">
        <h2 id="sc-states-title" class="card-title">{{ 'showcase.states' | translate }}</h2>
        <p class="card-subtitle mt-1">{{ 'showcase.statesHint' | translate }}</p>
        <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ui-text-input inputId="st-disabled" [label]="'showcase.statesList.disabled' | translate" [formField]="statesForm.disabledText" />
          <ui-select inputId="st-readonly" [label]="'showcase.statesList.readonly' | translate" [options]="planOptions()" [formField]="statesForm.readonlyPlan" />
          <ui-combobox inputId="st-loading" loading [label]="'showcase.statesList.loading' | translate" [placeholder]="'showcase.fields.companyPlaceholder' | translate" [options]="[]" [formField]="statesForm.loadingCompany" />
          <ui-text-input inputId="st-error" type="email" [label]="'showcase.statesList.error' | translate" [formField]="statesForm.invalidEmail" />
          <ui-date-picker inputId="st-date-disabled" [label]="'showcase.statesList.disabledDate' | translate" [formField]="statesForm.disabledDate" />
          <ui-currency-input inputId="st-amount" [label]="'showcase.statesList.readonlyAmount' | translate" [formField]="statesForm.readonlyAmount" />
          <ui-checkbox inputId="st-check" [label]="'showcase.statesList.disabledCheckbox' | translate" [formField]="statesForm.disabledCheck" />
          <ui-toggle inputId="st-toggle" [label]="'showcase.statesList.readonlyToggle' | translate" [formField]="statesForm.readonlyToggle" />
        </div>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormShowcasePage {
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(CLOCK);
  private readonly contacts = inject(ContactsStore);
  protected readonly companies = inject(CompaniesStore);

  protected readonly today = computed(() => toIsoDate(this.clock()));
  protected readonly lastResult = signal<'valid' | 'invalid' | null>(null);

  protected readonly model = signal<PlaygroundModel>(this.initialModel());

  protected readonly playground = form(this.model, (p) => {
    required(p.fullName, { message: 'validation.required' });
    minLength(p.fullName, 2);
    required(p.email, { message: 'validation.required' });
    email(p.email, { message: 'validation.email' });
    validate(p.phone, ({ value }) =>
      value().trim() && !/^\+?[\d\s().-]{7,20}$/.test(value().trim()) ? { kind: 'phone', message: 'validation.phone' } : undefined,
    );
    required(p.password, { message: 'validation.required' });
    minLength(p.password, 8);
    min(p.seats, 1);
    max(p.seats, 500);
    min(p.budget, 1, { message: 'validation.positive' });
    required(p.plan, { message: 'validation.required' });
    required(p.companyId, { message: 'validation.required' });
    required(p.startDate, { message: 'validation.required' });
    validate(p.startDate, ({ value }) =>
      value() && value() < this.today() ? { kind: 'past', message: 'showcase.validation.future' } : undefined,
    );
    maxLength(p.notes, 280);
    validate(p.terms, ({ value }) => (value() ? undefined : { kind: 'terms', message: 'showcase.validation.terms' }));
  });

  /** A second form whose states come from Signal Forms rules (`disabled()`, `readonly()`). */
  private readonly statesModel = signal({
    disabledText: 'Northwind Analytics',
    readonlyPlan: 'growth',
    loadingCompany: '',
    invalidEmail: 'not-an-email',
    disabledDate: toIsoDate(addDays(this.clock(), 3)),
    readonlyAmount: 48500,
    disabledCheck: true,
    readonlyToggle: true,
  });

  protected readonly statesForm = form(this.statesModel, (p) => {
    disabled(p.disabledText);
    readonly(p.readonlyPlan);
    email(p.invalidEmail, { message: 'validation.email' });
    disabled(p.disabledDate);
    readonly(p.readonlyAmount);
    disabled(p.disabledCheck);
    readonly(p.readonlyToggle);
  });

  protected readonly planOptions = computed(() =>
    PLANS.map((plan) => ({ value: plan, label: this.language.t(`showcase.plans.${plan}`) })),
  );

  protected readonly companyOptions = computed(() => {
    const counts = new Map<string, number>();
    for (const c of this.contacts.entities()) if (c.companyId) counts.set(c.companyId, (counts.get(c.companyId) ?? 0) + 1);
    return this.companies.sorted().map((c) => ({
      value: c.id,
      label: c.name,
      description: this.language.plural('showcase.contactCount', counts.get(c.id) ?? 0),
    }));
  });

  protected readonly resultMessage = computed(() => {
    const result = this.lastResult();
    if (!result) return '';
    return result === 'valid'
      ? this.language.t('showcase.resultValid')
      : this.language.plural('showcase.resultInvalid', this.playground().errorSummary().length);
  });

  protected readonly flags = computed(() => {
    const state = this.playground();
    return [
      { key: 'valid', value: state.valid() },
      { key: 'touched', value: state.touched() },
      { key: 'dirty', value: state.dirty() },
      { key: 'pending', value: state.pending() },
    ];
  });

  constructor() {
    // The states gallery shows an error state without waiting for a blur.
    this.statesForm.invalidEmail().markAsTouched();
  }

  protected async validateForm(event: Event): Promise<void> {
    event.preventDefault();
    this.lastResult.set(null);
    const ok = await submit(this.playground, async () => {
      this.toast.success('showcase.toastValid', { name: this.model().fullName.trim() });
    });
    this.lastResult.set(ok ? 'valid' : 'invalid');
  }

  protected resetForm(): void {
    this.playground().reset(this.initialModel());
    this.lastResult.set(null);
  }

  private initialModel(): PlaygroundModel {
    return {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      seats: 10,
      budget: 25000,
      plan: '',
      companyId: '',
      startDate: toIsoDate(addDays(this.clock(), 7)),
      startTime: '09:30',
      notes: '',
      terms: false,
      updates: true,
    };
  }
}
