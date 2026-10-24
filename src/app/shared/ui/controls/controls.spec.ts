import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField, maxLength, min, readonly, required, validate } from '@angular/forms/signals';
import { setupWorkspace } from '../../../../testing/test-providers';
import { LanguageService } from '../../../core/i18n/language.service';
import { Checkbox, Toggle } from './checkbox';
import { Combobox } from './combobox';
import { CurrencyInput } from './currency-input';
import { DatePicker } from './date-picker';
import { NumberInput } from './number-input';
import { Select } from './select';
import { TextInput } from './text-input';
import { Textarea } from './textarea';

@Component({
  imports: [FormField, TextInput, Textarea, Select, Combobox, NumberInput, CurrencyInput, DatePicker, Checkbox, Toggle],
  template: `
    <ui-text-input inputId="name" testId="name" label="Name" [formField]="f.name" />
    <ui-text-input inputId="secret" type="password" label="Password" [formField]="f.secret" />
    <ui-text-input inputId="locked" label="Locked" [formField]="f.locked" />
    <ui-textarea inputId="notes" label="Notes" [formField]="f.notes" />
    <ui-select inputId="plan" label="Plan" placeholder="Choose" [options]="options" [formField]="f.plan" />
    <ui-select inputId="fixed" label="Fixed" [options]="options" [formField]="f.fixed" />
    <ui-combobox inputId="company" label="Company" [options]="companies" clearable [formField]="f.company" />
    <ui-number-input inputId="seats" label="Seats" [formField]="f.seats" />
    <ui-currency-input inputId="budget" label="Budget" [formField]="f.budget" />
    <ui-date-picker inputId="start" label="Start" shortcuts [formField]="f.start" />
    <ui-checkbox inputId="terms" label="Terms" [formField]="f.terms" />
    <ui-toggle inputId="updates" label="Updates" [formField]="f.updates" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly options = [
    { value: 'starter', label: 'Starter' },
    { value: 'growth', label: 'Growth' },
  ];
  readonly companies = [
    { value: 'co_001', label: 'Atlas Fabrication', keywords: 'Lyon' },
    { value: 'co_002', label: 'Brightpath Health', keywords: 'Boston' },
    { value: 'co_003', label: 'Ćorović Logistics', keywords: 'Belgrade' },
  ];
  readonly model = signal({
    name: '',
    secret: '',
    locked: 'read me',
    notes: '',
    plan: '',
    fixed: 'growth',
    company: '',
    seats: 10,
    budget: 25000,
    start: '',
    terms: false,
    updates: true,
  });
  readonly f = form(this.model, (p) => {
    required(p.name, { message: 'validation.required' });
    disabled(p.locked);
    maxLength(p.notes, 20);
    required(p.plan, { message: 'validation.required' });
    readonly(p.fixed);
    min(p.seats, 1);
    validate(p.terms, ({ value }) => (value() ? undefined : { kind: 'terms', message: 'validation.required' }));
  });
}

describe('Orbit form controls (Signal Forms custom controls)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;

  const q = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const settle = () => fixture.whenStable();
  async function type(id: string, value: string): Promise<void> {
    const input = q<HTMLInputElement>(`#${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }
  async function blur(id: string): Promise<void> {
    q(`#${id}`).dispatchEvent(new Event('blur'));
    await settle();
  }
  const errorOf = (id: string) => el.querySelector(`#${id}-error`)?.textContent?.trim() ?? null;

  beforeEach(async () => {
    await setupWorkspace();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    await settle();
  });

  it('two-way binds a text input and reports touched on blur', async () => {
    await type('name', 'Nadia');
    expect(host.model().name).toBe('Nadia');
    expect(host.f.name().dirty()).toBe(true);
    expect(host.f.name().touched()).toBe(false);
    await blur('name');
    expect(host.f.name().touched()).toBe(true);
    expect(q('#name').getAttribute('data-testid')).toBe('name');
  });

  it('shows translated errors once touched and links them with aria attributes', async () => {
    expect(errorOf('name')).toBeNull();
    await blur('name');
    expect(errorOf('name')).toBe('This field is required');
    expect(q('#name').getAttribute('aria-invalid')).toBe('true');
    expect(q('#name').getAttribute('aria-describedby')).toBe('name-error');

    await TestBed.inject(LanguageService).use('ar');
    await settle();
    expect(errorOf('name')).toBe('هذا الحقل مطلوب');
  });

  it('applies disabled and readonly rules from the form schema', async () => {
    expect(q<HTMLInputElement>('#locked').disabled).toBe(true);
    // A read-only dropdown shows its value but does not open.
    const fixed = q<HTMLButtonElement>('#fixed');
    expect(fixed.getAttribute('aria-readonly')).toBe('true');
    expect(fixed.textContent?.trim()).toBe('Growth');
    fixed.click();
    await settle();
    expect(fixed.getAttribute('aria-expanded')).toBe('false');
  });

  it('reveals a password on demand with an accessible toggle', async () => {
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-controls="secret"]')!;
    expect(q<HTMLInputElement>('#secret').type).toBe('password');
    toggle.click();
    await settle();
    expect(q<HTMLInputElement>('#secret').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('counts characters against a maxLength() validator', async () => {
    await type('notes', 'Call back');
    expect(q('#notes-count').textContent?.trim()).toBe('9 / 20');
    expect(q('#notes').getAttribute('aria-describedby')).toContain('notes-count');
  });

  it('opens a styled listbox and selects with the mouse', async () => {
    const trigger = q<HTMLButtonElement>('#plan');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.textContent?.trim()).toBe('Choose');
    trigger.click();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const options = [...document.querySelectorAll<HTMLElement>('#plan-listbox [role="option"]')];
    // The placeholder is a selectable empty option.
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Choose', 'Starter', 'Growth']);
    options[2].click();
    await settle();
    expect(host.model().plan).toBe('growth');
    expect(trigger.textContent?.trim()).toBe('Growth');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.f.plan().touched()).toBe(true);
  });

  it('supports keyboard navigation and type-ahead in the dropdown', async () => {
    const trigger = q<HTMLButtonElement>('#plan');
    const key = (k: string) => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    trigger.focus();
    key('ArrowDown');
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('plan-option-0');
    key('s');
    await settle();
    expect(trigger.getAttribute('aria-activedescendant')).toBe('plan-option-1');
    key('End');
    await settle();
    expect(trigger.getAttribute('aria-activedescendant')).toBe('plan-option-2');
    key('Enter');
    await settle();
    expect(host.model().plan).toBe('growth');

    // Escape closes the list without reaching ancestors (e.g. a dialog).
    key('ArrowDown');
    const outside = vi.fn();
    el.addEventListener('keydown', outside);
    key('Escape');
    await settle();
    expect(outside).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('filters the searchable select accent-insensitively and picks with the keyboard', async () => {
    const input = q<HTMLInputElement>('#company');
    input.focus();
    await type('company', 'corovic');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Ćorović Logistics']);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(host.model().company).toBe('co_003');
    expect(input.value).toBe('Ćorović Logistics');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('matches keywords, moves with the arrow keys and closes on Escape without bubbling', async () => {
    const input = q<HTMLInputElement>('#company');
    input.focus();
    await type('company', 'bo');
    expect(document.querySelectorAll('[role="option"]').length).toBe(1);
    await type('company', '');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(input.getAttribute('aria-activedescendant')).toBe('company-option-1');

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const outside = vi.fn();
    el.addEventListener('keydown', outside);
    input.dispatchEvent(escape);
    await settle();
    expect(outside).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('clears a clearable searchable select', async () => {
    host.model.update((m) => ({ ...m, company: 'co_002' }));
    await settle();
    el.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!.click();
    await settle();
    expect(host.model().company).toBe('');
  });

  it('reports non-numeric text as a parse error instead of writing 0', async () => {
    await type('seats', '');
    await blur('seats');
    expect(host.model().seats).toBe(10);
    expect(host.f.seats().invalid()).toBe(true);
    expect(errorOf('seats')).toBe('Enter a number');
    await type('seats', '0');
    expect(errorOf('seats')).toBe('Must be at least 1');
    expect(q('#seats').getAttribute('min')).toBe('1');
  });

  it('parses money with locale separators and Arabic-Indic digits', async () => {
    const input = q<HTMLInputElement>('#budget');
    expect(input.value).toBe('25,000');
    await type('budget', '12,500.5');
    expect(host.model().budget).toBe(12500.5);
    await type('budget', '١٢٥٠٠');
    expect(host.model().budget).toBe(12500);
    await type('budget', '12abc');
    expect(host.model().budget).toBe(12500);
    expect(host.f.budget().invalid()).toBe(true);
    await blur('budget');
    expect(errorOf('budget')).toBe('Enter a valid amount, e.g. 12500');
  });

  it('formats money in French and keeps the currency symbol after the amount', async () => {
    await TestBed.inject(LanguageService).use('fr');
    await settle();
    const input = q<HTMLInputElement>('#budget');
    expect(input.value.replace(/\s/g, ' ')).toBe('25 000');
    await type('budget', '1 234,5');
    expect(host.model().budget).toBe(1234.5);
    await blur('budget');
    expect(input.value.replace(/\s/g, ' ')).toBe('1 234,5');
  });

  it('sets dates from quick picks and echoes them in the application language', async () => {
    el.querySelector<HTMLButtonElement>('[aria-label="Quick dates"] button:nth-child(2)')!.click();
    await settle();
    expect(host.model().start).toBe('2026-06-16');
    expect(q('#start-hint').textContent?.trim()).toBe('Tuesday, June 16, 2026');
    await TestBed.inject(LanguageService).use('fr');
    await settle();
    expect(q('#start-hint').textContent?.trim()).toBe('mardi 16 juin 2026');
  });

  it('binds checkboxes and switches as FormCheckboxControl', async () => {
    const terms = q<HTMLInputElement>('#terms');
    const updates = q<HTMLInputElement>('#updates');
    expect(updates.checked).toBe(true);
    expect(updates.getAttribute('role')).toBe('switch');
    expect(terms.getAttribute('role')).toBeNull();
    terms.click();
    await settle();
    expect(host.model().terms).toBe(true);
    expect(host.f.terms().valid()).toBe(true);
  });
});
