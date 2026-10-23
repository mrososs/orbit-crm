import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { setupWorkspace } from '../../../testing/test-providers';
import { LanguageService } from '../../core/i18n/language.service';
import { ContactsStore } from '../../state/entity-stores';
import { ContactFormDialog } from './contact-form-dialog';

describe('ContactFormDialog validation', () => {
  let fixture: ComponentFixture<ContactFormDialog>;
  let element: HTMLElement;
  const close = vi.fn();

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(ContactFormDialog);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function type(testId: string, value: string): Promise<void> {
    const input = element.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  const errors = () => [...element.querySelectorAll('.field-error')].map((e) => e.textContent!.trim());

  beforeEach(async () => {
    close.mockReset();
    await setupWorkspace({}, [
      provideRouter([]),
      { provide: DialogRef, useValue: { close } },
      { provide: DIALOG_DATA, useValue: {} },
    ]);
  });

  it('shows required-field errors after a submit attempt and does not save', async () => {
    await render();
    await submit();
    expect(errors()).toEqual(expect.arrayContaining(['This field is required']));
    expect(close).not.toHaveBeenCalled();
    expect(element.querySelector('#contact-first')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('validates email format and uniqueness', async () => {
    await render();
    await type('contact-first-name', 'Nadia');
    await type('contact-last-name', 'Karim');
    await type('contact-email', 'not-an-email');
    await submit();
    expect(errors()).toContain('Enter a valid email address');

    const existing = TestBed.inject(ContactsStore).entities()[0].email;
    await type('contact-email', existing.toUpperCase());
    await submit();
    expect(errors()).toContain('A contact with this email already exists');
  });

  it('displays validation messages in the active language', async () => {
    await TestBed.inject(LanguageService).use('fr');
    await render();
    await submit();
    expect(errors()).toContain('Ce champ est obligatoire');

    await TestBed.inject(LanguageService).use('ar');
    await fixture.whenStable();
    expect(errors()).toContain('هذا الحقل مطلوب');
  });

  it('rejects malformed phone numbers', async () => {
    await render();
    await type('contact-phone', 'call me');
    await submit();
    expect(errors()).toContain('Enter a valid phone number');
  });

  it('creates the contact when the form is valid', async () => {
    await render();
    await type('contact-first-name', 'Nadia');
    await type('contact-last-name', 'Karim');
    await type('contact-email', 'nadia.karim@example.org');
    await type('contact-phone', '+33 1 99 00 12 34');
    await submit();

    expect(errors(), JSON.stringify(errors())).toEqual([]);
    expect(close).toHaveBeenCalledTimes(1);
    const saved = close.mock.calls[0][0];
    expect(saved).toMatchObject({ firstName: 'Nadia', email: 'nadia.karim@example.org' });
    expect(TestBed.inject(ContactsStore).entityMap()[saved.id]).toBeDefined();
  });
});
