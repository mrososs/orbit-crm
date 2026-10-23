import { inject, Injectable } from '@angular/core';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import type { ActivityDraft, CompanyDraft, ContactDraft, DealDraft } from '../../state/crm.service';
import type { Activity, Company, Contact, Deal } from '../models';

/**
 * Opens entity create/edit dialogs from anywhere (top bar, pages, palette).
 * Dialogs are loaded on demand so they stay out of the initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class QuickCreateService {
  private readonly dialogs = inject(DialogService);

  async deal(defaults: Partial<DealDraft> = {}, deal?: Deal): Promise<Deal | undefined> {
    const { DealFormDialog } = await import('../../features/deals/deal-form-dialog');
    return this.dialogs.result(this.dialogs.open<Deal>(DealFormDialog, { data: { defaults, deal }, size: 'lg' }));
  }

  async contact(defaults: Partial<ContactDraft> = {}, contact?: Contact): Promise<Contact | undefined> {
    const { ContactFormDialog } = await import('../../features/contacts/contact-form-dialog');
    return this.dialogs.result(
      this.dialogs.open<Contact>(ContactFormDialog, { data: { defaults, contact }, size: 'lg' }),
    );
  }

  async company(defaults: Partial<CompanyDraft> = {}, company?: Company): Promise<Company | undefined> {
    const { CompanyFormDialog } = await import('../../features/companies/company-form-dialog');
    return this.dialogs.result(
      this.dialogs.open<Company>(CompanyFormDialog, { data: { defaults, company }, size: 'lg' }),
    );
  }

  async activity(defaults: Partial<ActivityDraft> = {}, activity?: Activity): Promise<Activity | undefined> {
    const { ActivityFormDialog } = await import('../../features/activities/activity-form-dialog');
    return this.dialogs.result(
      this.dialogs.open<Activity>(ActivityFormDialog, { data: { defaults, activity }, size: 'md' }),
    );
  }
}
