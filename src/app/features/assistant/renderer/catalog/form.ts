import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { A2uiRendererService, CatalogComponent, ComponentHostComponent } from '@a2ui/angular';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { formatCurrency } from '../../../../core/i18n/locale.utils';
import { Button } from '../../../../shared/ui/button';
import { Combobox } from '../../../../shared/ui/controls/combobox';
import { DatePicker } from '../../../../shared/ui/controls/date-picker';
import { Select, SelectOption } from '../../../../shared/ui/controls/select';
import { TextInput } from '../../../../shared/ui/controls/text-input';
import { ValidationLike } from '../../../../shared/ui/form-field';
import {
  ConfirmationApi,
  DateFieldApi,
  DetailListSchema,
  FormApi,
  OptionListSchema,
  SelectFieldApi,
  TextFieldApi,
} from '../../schemas/a2ui.schemas';
import { dispatchSurfaceAction, parseData } from './catalog-utils';

interface FieldProps {
  error?: { value: () => unknown; onUpdate: (v: unknown) => void };
  testId?: { value: () => unknown };
}

/** Shared behaviour of the field components: stable ids, agent-provided errors (translation keys). */
function fieldState(component: { props: () => unknown; surfaceId: () => string; componentId: () => string }) {
  const props = () => component.props() as unknown as FieldProps;
  return {
    inputId: computed(() => `${component.surfaceId()}-${component.componentId()}`.replace(/[^a-z0-9-]/gi, '-')),
    testId: computed(() => (props().testId?.value() as string | undefined) ?? null),
    errors: computed<ValidationLike[]>(() => {
      const key = props().error?.value();
      return typeof key === 'string' && key ? [{ kind: 'agent', message: key }] : [];
    }),
    /** Editing a field clears the error the agent reported for it. */
    clearError: () => {
      if (props().error?.value()) props().error?.onUpdate('');
    },
  };
}

@Component({
  selector: 'app-a2ui-text-field',
  imports: [TextInput],
  template: `
    <ui-text-input
      [inputId]="field.inputId()"
      [testId]="field.testId()"
      [label]="label()"
      [placeholder]="placeholder()"
      [hint]="hint()"
      [optional]="optional()"
      [maxLength]="maxLength()"
      [value]="value()"
      [errors]="field.errors()"
      [touched]="field.errors().length > 0"
      (valueChange)="update($event)"
    />
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2TextField extends CatalogComponent<typeof TextFieldApi> {
  protected readonly field = fieldState(this);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly placeholder = computed(() => this.props()['placeholder']?.value() ?? '');
  protected readonly hint = computed(() => this.props()['hint']?.value() ?? '');
  protected readonly optional = computed(() => this.props()['optional']?.value() === true);
  protected readonly maxLength = computed(() => this.props()['maxLength']?.value());
  protected readonly value = computed(() => String(this.props()['value']?.value() ?? ''));

  protected update(value: string): void {
    this.props()['value']?.onUpdate(value as never);
    this.field.clearError();
  }
}

@Component({
  selector: 'app-a2ui-select-field',
  imports: [Select, Combobox],
  template: `
    @if (searchable()) {
      <ui-combobox
        [inputId]="field.inputId()"
        [testId]="field.testId()"
        [label]="label()"
        [placeholder]="placeholder()"
        [hint]="hint()"
        [optional]="optional()"
        [clearable]="optional()"
        [options]="options()"
        [value]="value()"
        [errors]="field.errors()"
        [touched]="field.errors().length > 0"
        (valueChange)="update($event)"
      />
    } @else {
      <ui-select
        [inputId]="field.inputId()"
        [testId]="field.testId()"
        [label]="label()"
        [placeholder]="placeholder()"
        [hint]="hint()"
        [optional]="optional()"
        [options]="options()"
        [value]="value()"
        [errors]="field.errors()"
        [touched]="field.errors().length > 0"
        (valueChange)="update($event)"
      />
    }
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2SelectField extends CatalogComponent<typeof SelectFieldApi> {
  private readonly language = inject(LanguageService);
  private readonly renderer = inject(A2uiRendererService);
  protected readonly field = fieldState(this);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly placeholder = computed(() => this.props()['placeholder']?.value() ?? '');
  protected readonly hint = computed(() => this.props()['hint']?.value() ?? '');
  protected readonly optional = computed(() => this.props()['optional']?.value() === true);
  protected readonly searchable = computed(() => this.props()['searchable']?.value() === true);
  protected readonly value = computed(() => String(this.props()['value']?.value() ?? ''));
  protected readonly options = computed<SelectOption[]>(() => {
    const parsed = parseData(OptionListSchema, this.props()['options']?.value());
    return (parsed.data ?? []).map((o) => ({
      value: o.value,
      label: o.label ?? (o.labelKey ? this.language.t(o.labelKey) : o.value),
      description: o.description,
      keywords: o.description,
    }));
  });

  protected update(value: string): void {
    this.props()['value']?.onUpdate(value as never);
    this.field.clearError();
    const action = this.props()['action']?.raw;
    if (action) dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), action);
  }
}

@Component({
  selector: 'app-a2ui-date-field',
  imports: [DatePicker],
  template: `
    <ui-date-picker
      [inputId]="field.inputId()"
      [testId]="field.testId()"
      [type]="type()"
      [shortcuts]="shortcuts()"
      [minDate]="minDate()"
      [label]="label()"
      [hint]="hint()"
      [optional]="optional()"
      [value]="value()"
      [errors]="field.errors()"
      [touched]="field.errors().length > 0"
      (valueChange)="update($event)"
    />
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2DateField extends CatalogComponent<typeof DateFieldApi> {
  protected readonly field = fieldState(this);
  protected readonly label = computed(() => this.props()['label']?.value() ?? '');
  protected readonly hint = computed(() => this.props()['hint']?.value() ?? '');
  protected readonly optional = computed(() => this.props()['optional']?.value() === true);
  protected readonly type = computed(() => this.props()['type']?.value() ?? 'date');
  protected readonly shortcuts = computed(() => this.props()['shortcuts']?.value() === true);
  protected readonly minDate = computed(() => this.props()['minDate']?.value() ?? '');
  protected readonly value = computed(() => String(this.props()['value']?.value() ?? ''));

  protected update(value: string): void {
    this.props()['value']?.onUpdate(value as never);
    this.field.clearError();
  }
}

/** Form container. Field values live in the surface data model; submit dispatches the form's action. */
@Component({
  selector: 'app-a2ui-form',
  imports: [ComponentHostComponent, Button, TranslatePipe, LucideDynamicIcon],
  template: `
    <form novalidate (submit)="submit($event)" [attr.data-testid]="testId()" [attr.aria-busy]="status() === 'submitting'">
      <fieldset class="min-w-0" [disabled]="locked()">
        @if (child(); as c) {
          <a2ui-v09-component-host [componentKey]="c" [surfaceId]="surfaceId()" />
        }
      </fieldset>
      @switch (status()) {
        @case ('submitted') {
          <p class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success-soft-fg" role="status">
            <svg lucideIcon="circle-check" [size]="14" aria-hidden="true"></svg>{{ 'assistant.form.submitted' | translate }}
          </p>
        }
        @case ('cancelled') {
          <p class="mt-3 text-xs text-fg-muted" role="status">{{ 'assistant.form.cancelled' | translate }}</p>
        }
        @default {
          <div class="mt-4 flex flex-wrap justify-end gap-2">
            @if (cancelLabel()) {
              <button ui-button type="button" size="sm" [disabled]="status() === 'submitting'" (click)="cancel()" data-testid="a2ui-form-cancel">
                {{ cancelLabel() }}
              </button>
            }
            <button ui-button type="submit" size="sm" variant="primary" [loading]="status() === 'submitting'" data-testid="a2ui-form-submit">
              {{ submitLabel() }}
            </button>
          </div>
        }
      }
    </form>
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Form extends CatalogComponent<typeof FormApi> {
  private readonly renderer = inject(A2uiRendererService);
  protected readonly child = computed(() => this.props()['child']?.value());
  protected readonly submitLabel = computed(() => this.props()['submitLabel']?.value() ?? '');
  protected readonly cancelLabel = computed(() => this.props()['cancelLabel']?.value() ?? '');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
  protected readonly status = computed(() => String(this.props()['status']?.value() ?? 'editing'));
  protected readonly locked = computed(() => this.status() !== 'editing');

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.locked()) return;
    dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), this.props()['action']?.raw);
  }

  protected cancel(): void {
    if (this.locked()) return;
    dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), this.props()['cancelAction']?.raw);
  }
}

/** Explicit confirmation before a write the visitor should double-check. */
@Component({
  selector: 'app-a2ui-confirmation',
  imports: [Button, TranslatePipe, LucideDynamicIcon],
  template: `
    <div
      class="rounded-xl border bg-surface p-3.5"
      [class]="tone() === 'danger' ? 'border-danger/40' : 'border-primary-border'"
      role="group"
      [attr.aria-label]="title()"
      [attr.data-testid]="testId()"
    >
      <p class="flex items-center gap-2 text-sm font-semibold text-fg">
        <svg lucideIcon="triangle-alert" [size]="15" class="shrink-0 text-warning" aria-hidden="true"></svg>{{ title() }}
      </p>
      <p class="mt-1 text-xs leading-5 text-fg-muted">{{ message() }}</p>
      @if (details().length) {
        <dl class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg bg-surface-sunken px-3 py-2.5 text-xs">
          @for (row of details(); track row.label) {
            <dt class="text-fg-muted">{{ row.label }}</dt>
            <dd class="truncate font-medium text-fg" [class.tabular]="row.numeric">{{ row.value }}</dd>
          }
        </dl>
      }
      @switch (status()) {
        @case ('confirmed') {
          <p class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-success-soft-fg" role="status">
            <svg lucideIcon="circle-check" [size]="14" aria-hidden="true"></svg>{{ 'assistant.form.confirmed' | translate }}
          </p>
        }
        @case ('cancelled') {
          <p class="mt-3 text-xs text-fg-muted" role="status">{{ 'assistant.form.cancelled' | translate }}</p>
        }
        @default {
          <div class="mt-3 flex flex-wrap justify-end gap-2">
            <button ui-button type="button" size="sm" (click)="run('cancelAction')" data-testid="a2ui-confirm-cancel">{{ cancelLabel() }}</button>
            <button ui-button type="button" size="sm" [variant]="tone() === 'danger' ? 'danger' : 'primary'" (click)="run('confirmAction')" data-testid="a2ui-confirm">
              {{ confirmLabel() }}
            </button>
          </div>
        }
      }
    </div>
  `,
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2Confirmation extends CatalogComponent<typeof ConfirmationApi> {
  private readonly renderer = inject(A2uiRendererService);
  private readonly language = inject(LanguageService);
  protected readonly title = computed(() => this.props()['title']?.value() ?? '');
  protected readonly message = computed(() => this.props()['message']?.value() ?? '');
  protected readonly confirmLabel = computed(() => this.props()['confirmLabel']?.value() ?? '');
  protected readonly cancelLabel = computed(() => this.props()['cancelLabel']?.value() ?? '');
  protected readonly tone = computed(() => this.props()['tone']?.value() ?? 'default');
  protected readonly testId = computed(() => this.props()['testId']?.value() ?? null);
  protected readonly status = computed(() => String(this.props()['status']?.value() ?? 'pending'));
  protected readonly details = computed(() => {
    const rows = parseData(DetailListSchema, this.props()['details']?.value()).data ?? [];
    return rows.map((row) => ({
      label: this.language.t(row.labelKey),
      value:
        row.value ??
        (row.valueKey ? this.language.t(row.valueKey) : row.amount !== undefined ? formatCurrency(row.amount, this.language.locale()) : ''),
      numeric: row.amount !== undefined,
    }));
  });

  protected run(kind: 'confirmAction' | 'cancelAction'): void {
    if (this.status() !== 'pending') return;
    dispatchSurfaceAction(this.renderer, this.surfaceId(), this.dataContextPath(), this.componentId(), this.props()[kind]?.raw);
  }
}
