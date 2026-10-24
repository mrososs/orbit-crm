import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { email, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  Contact,
  CONTACT_STATUSES,
  ContactStatus,
  fullName,
  LEAD_SOURCES,
  LeadSource,
} from '../../core/models';
import { LanguageService } from '../../core/i18n/language.service';
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { Select } from '../../shared/ui/controls/select';
import { TextInput } from '../../shared/ui/controls/text-input';
import { Textarea } from '../../shared/ui/controls/textarea';
import { ContactDraft, CrmService } from '../../state/crm.service';
import { CompaniesStore, ContactsStore, TeamStore } from '../../state/entity-stores';

export interface ContactFormData {
  contact?: Contact;
  defaults?: Partial<ContactDraft>;
}

interface ContactFormModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  companyId: string;
  status: ContactStatus;
  source: LeadSource;
  ownerId: string;
  notes: string;
}

export const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

@Component({
  selector: 'app-contact-form-dialog',
  imports: [DialogFrame, FormField, TextInput, Select, Textarea, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'contacts.editTitle' : 'contacts.newTitle') | translate"
        [description]="(isEdit ? 'contacts.editDescription' : 'contacts.newDescription') | translate"
        icon="user-plus"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-text-input inputId="contact-first" testId="contact-first-name" autocomplete="off" [label]="'contacts.fields.firstName' | translate" [formField]="contactForm.firstName" />
          <ui-text-input inputId="contact-last" testId="contact-last-name" autocomplete="off" [label]="'contacts.fields.lastName' | translate" [formField]="contactForm.lastName" />
          <ui-text-input inputId="contact-email" testId="contact-email" type="email" autocomplete="off" [label]="'contacts.fields.email' | translate" [formField]="contactForm.email" />
          <ui-text-input inputId="contact-phone" testId="contact-phone" type="tel" autocomplete="off" optional [label]="'contacts.fields.phone' | translate" [formField]="contactForm.phone" />
          <ui-text-input inputId="contact-title" testId="contact-title" optional [label]="'contacts.fields.jobTitle' | translate" [placeholder]="'contacts.fields.jobTitlePlaceholder' | translate" [formField]="contactForm.jobTitle" />
          <ui-select inputId="contact-company" testId="contact-company" [label]="'contacts.fields.company' | translate" [placeholder]="'contacts.fields.noCompany' | translate" [options]="companyOptions()" [formField]="contactForm.companyId" />
          <ui-select inputId="contact-status" testId="contact-status" [label]="'contacts.fields.status' | translate" [options]="statusOptions()" [formField]="contactForm.status" />
          <ui-select inputId="contact-source" [label]="'contacts.fields.source' | translate" [options]="sourceOptions()" [formField]="contactForm.source" />
          <ui-select class="sm:col-span-2" inputId="contact-owner" [label]="'contacts.fields.owner' | translate" [options]="ownerOptions()" [formField]="contactForm.ownerId" />
          <ui-textarea class="sm:col-span-2" inputId="contact-notes" optional [label]="'contacts.fields.notes' | translate" [placeholder]="'contacts.fields.notesPlaceholder' | translate" [formField]="contactForm.notes" />
        </div>

        @if (failed()) {
          <p class="mt-4 text-sm text-danger" role="alert">{{ 'errors.saveFailed' | translate }}</p>
        }

        <ng-container dialogFooter>
          <button ui-button type="button" (click)="ref.close()">{{ 'common.cancel' | translate }}</button>
          <button ui-button type="submit" variant="primary" [loading]="saving()" data-testid="contact-submit">
            {{ (isEdit ? 'common.saveChanges' : 'contacts.create') | translate }}
          </button>
        </ng-container>
      </ui-dialog-frame>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormDialog {
  protected readonly ref = inject<DialogRef<Contact>>(DialogRef);
  private readonly data = inject<ContactFormData>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly crm = inject(CrmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly contacts = inject(ContactsStore);
  private readonly companies = inject(CompaniesStore);
  private readonly team = inject(TeamStore);
  private readonly language = inject(LanguageService);

  protected readonly isEdit = !!this.data.contact;

  protected readonly companyOptions = computed(() => this.companies.sorted().map((c) => ({ value: c.id, label: c.name })));
  protected readonly statusOptions = computed(() =>
    CONTACT_STATUSES.map((s) => ({ value: s, label: this.language.t(`enums.contactStatus.${s}`) })),
  );
  protected readonly sourceOptions = computed(() =>
    LEAD_SOURCES.map((s) => ({ value: s, label: this.language.t(`enums.source.${s}`) })),
  );
  protected readonly ownerOptions = computed(() => this.team.members().map((m) => ({ value: m.id, label: fullName(m) })));
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  /** Set while persisting so uniqueness checks ignore the record being saved. */
  private readonly persisting = signal(false);

  private readonly model = signal<ContactFormModel>(this.initialModel());

  protected readonly contactForm = form(this.model, (p) => {
    required(p.firstName, { message: 'validation.required' });
    required(p.lastName, { message: 'validation.required' });
    required(p.email, { message: 'validation.required' });
    email(p.email, { message: 'validation.email' });
    validate(p.email, ({ value }) => {
      if (this.persisting()) return undefined;
      const address = value().trim().toLowerCase();
      const selfId = this.data.contact?.id;
      const taken = this.contacts.entities().some((c) => c.id !== selfId && c.email.toLowerCase() === address);
      return taken ? { kind: 'duplicate', message: 'validation.duplicateEmail' } : undefined;
    });
    validate(p.phone, ({ value }) =>
      value().trim() && !PHONE_PATTERN.test(value().trim()) ? { kind: 'phone', message: 'validation.phone' } : undefined,
    );
    required(p.ownerId, { message: 'validation.required' });
  });

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.failed.set(false);
    await submit(this.contactForm, async () => {
      this.saving.set(true);
      this.persisting.set(true);
      const m = this.model();
      const draft: ContactDraft = {
        firstName: m.firstName.trim(),
        lastName: m.lastName.trim(),
        email: m.email.trim().toLowerCase(),
        phone: m.phone.trim(),
        jobTitle: m.jobTitle.trim(),
        companyId: m.companyId || null,
        status: m.status,
        source: m.source,
        ownerId: m.ownerId,
        notes: m.notes.trim(),
      };
      try {
        if (this.data.contact) {
          const saved = await this.crm.updateContact(this.data.contact.id, draft);
          this.toast.success('contacts.updated');
          this.ref.close(saved);
        } else {
          const saved = await this.crm.createContact(draft);
          this.toast.success('contacts.created', undefined, {
            label: 'common.view',
            run: () => void this.router.navigate(['/contacts', saved.id]),
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

  private initialModel(): ContactFormModel {
    const c = this.data.contact;
    const d = this.data.defaults ?? {};
    return {
      firstName: c?.firstName ?? d.firstName ?? '',
      lastName: c?.lastName ?? d.lastName ?? '',
      email: c?.email ?? d.email ?? '',
      phone: c?.phone ?? d.phone ?? '',
      jobTitle: c?.jobTitle ?? d.jobTitle ?? '',
      companyId: c?.companyId ?? d.companyId ?? '',
      status: c?.status ?? d.status ?? 'lead',
      source: c?.source ?? d.source ?? 'website',
      ownerId: c?.ownerId ?? d.ownerId ?? CURRENT_USER_ID,
      notes: c?.notes ?? d.notes ?? '',
    };
  }
}
