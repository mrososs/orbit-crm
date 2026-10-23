import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { CURRENT_USER_ID } from '../../core/services/session';
import { ToastService } from '../../core/services/toast.service';
import { FieldAria } from '../../shared/directives/field-aria';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog/dialog-frame';
import { FormFieldShell } from '../../shared/ui/form-field';
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
  imports: [DialogFrame, FormField, FieldAria, FormFieldShell, Button, TranslatePipe],
  template: `
    <form (submit)="save($event)" novalidate class="contents">
      <ui-dialog-frame
        [heading]="(isEdit ? 'contacts.editTitle' : 'contacts.newTitle') | translate"
        [description]="(isEdit ? 'contacts.editDescription' : 'contacts.newDescription') | translate"
        icon="user-plus"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ui-form-field for="contact-first" [label]="'contacts.fields.firstName' | translate" [field]="contactForm.firstName">
            <input id="contact-first" class="control" autocomplete="off" [formField]="contactForm.firstName" data-testid="contact-first-name" />
          </ui-form-field>
          <ui-form-field for="contact-last" [label]="'contacts.fields.lastName' | translate" [field]="contactForm.lastName">
            <input id="contact-last" class="control" autocomplete="off" [formField]="contactForm.lastName" data-testid="contact-last-name" />
          </ui-form-field>
          <ui-form-field for="contact-email" [label]="'contacts.fields.email' | translate" [field]="contactForm.email">
            <input id="contact-email" type="email" dir="ltr" class="control" autocomplete="off" [formField]="contactForm.email" data-testid="contact-email" />
          </ui-form-field>
          <ui-form-field for="contact-phone" [label]="'contacts.fields.phone' | translate" [field]="contactForm.phone" [optional]="'common.optional' | translate">
            <input id="contact-phone" type="tel" dir="ltr" class="control" autocomplete="off" [formField]="contactForm.phone" data-testid="contact-phone" />
          </ui-form-field>
          <ui-form-field for="contact-title" [label]="'contacts.fields.jobTitle' | translate" [optional]="'common.optional' | translate">
            <input id="contact-title" class="control" [formField]="contactForm.jobTitle" [placeholder]="'contacts.fields.jobTitlePlaceholder' | translate" data-testid="contact-title" />
          </ui-form-field>
          <ui-form-field for="contact-company" [label]="'contacts.fields.company' | translate">
            <select id="contact-company" class="control" [formField]="contactForm.companyId" data-testid="contact-company">
              <option value="">{{ 'contacts.fields.noCompany' | translate }}</option>
              @for (c of companies.sorted(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field for="contact-status" [label]="'contacts.fields.status' | translate">
            <select id="contact-status" class="control" [formField]="contactForm.status" data-testid="contact-status">
              @for (s of statuses; track s) {
                <option [value]="s">{{ 'enums.contactStatus.' + s | translate }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field for="contact-source" [label]="'contacts.fields.source' | translate">
            <select id="contact-source" class="control" [formField]="contactForm.source">
              @for (s of sources; track s) {
                <option [value]="s">{{ 'enums.source.' + s | translate }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field class="sm:col-span-2" for="contact-owner" [label]="'contacts.fields.owner' | translate" [field]="contactForm.ownerId">
            <select id="contact-owner" class="control" [formField]="contactForm.ownerId">
              @for (m of team.members(); track m.id) {
                <option [value]="m.id">{{ name(m) }}</option>
              }
            </select>
          </ui-form-field>
          <ui-form-field class="sm:col-span-2" for="contact-notes" [label]="'contacts.fields.notes' | translate" [optional]="'common.optional' | translate">
            <textarea id="contact-notes" rows="3" class="control" [formField]="contactForm.notes" [placeholder]="'contacts.fields.notesPlaceholder' | translate"></textarea>
          </ui-form-field>
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
  protected readonly companies = inject(CompaniesStore);
  protected readonly team = inject(TeamStore);

  protected readonly isEdit = !!this.data.contact;
  protected readonly statuses = CONTACT_STATUSES;
  protected readonly sources = LEAD_SOURCES;
  protected readonly name = fullName;
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
