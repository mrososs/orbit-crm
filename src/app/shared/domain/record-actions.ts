import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { QuickCreateService } from '../../core/layout/quick-create.service';
import { Activity, Company, Contact, Deal, DealStage, fullName } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { CrmService } from '../../state/crm.service';
import { ContactsStore, DealsStore } from '../../state/entity-stores';
import { ConfirmService } from '../ui/dialog/confirm-dialog';

/**
 * UI-level record workflows shared across features: confirmation dialogs,
 * toasts with undo, and post-action navigation around CrmService commands.
 */
@Injectable({ providedIn: 'root' })
export class RecordActions {
  private readonly crm = inject(CrmService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly dialogs = inject(QuickCreateService);
  private readonly contacts = inject(ContactsStore);
  private readonly deals = inject(DealsStore);

  // ── Deals ────────────────────────────────────────────────────────────

  async moveDeal(deal: Deal, stage: DealStage): Promise<void> {
    try {
      const receipt = await this.crm.moveDeal(deal.id, stage);
      if (!receipt) return;
      const key = stage === 'won' ? 'pipeline.won' : stage === 'lost' ? 'pipeline.lost' : 'pipeline.moved';
      this.toast.show({
        tone: stage === 'lost' ? 'info' : 'success',
        title: key,
        params: { name: deal.name, stage: { translate: `enums.stage.${stage}` } },
        action: { label: 'common.undo', run: () => this.crm.undoMove(receipt) },
      });
    } catch {
      this.toast.error('pipeline.moveFailed');
    }
  }

  editDeal(deal: Deal): Promise<Deal | undefined> {
    return this.dialogs.deal({}, deal);
  }

  async deleteDeal(deal: Deal, navigateTo?: string): Promise<boolean> {
    const confirmed = await this.confirmService.confirm({
      title: 'deals.deleteTitle',
      message: 'deals.deleteMessage',
      confirmLabel: 'deals.deleteConfirm',
      params: { name: deal.name },
      tone: 'danger',
      onConfirm: () => this.crm.deleteDeal(deal.id),
    });
    if (confirmed) {
      this.toast.success('deals.deleted');
      if (navigateTo) void this.router.navigateByUrl(navigateTo);
    }
    return confirmed;
  }

  // ── Contacts ─────────────────────────────────────────────────────────

  editContact(contact: Contact): Promise<Contact | undefined> {
    return this.dialogs.contact({}, contact);
  }

  async deleteContact(contact: Contact, navigateTo?: string): Promise<boolean> {
    const confirmed = await this.confirmService.confirm({
      title: 'contacts.deleteTitle',
      message: 'contacts.deleteMessage',
      confirmLabel: 'contacts.deleteConfirm',
      params: { name: fullName(contact) },
      tone: 'danger',
      onConfirm: () => this.crm.deleteContact(contact.id),
    });
    if (confirmed) {
      this.toast.success('contacts.deleted');
      if (navigateTo) void this.router.navigateByUrl(navigateTo);
    }
    return confirmed;
  }

  // ── Companies ────────────────────────────────────────────────────────

  editCompany(company: Company): Promise<Company | undefined> {
    return this.dialogs.company({}, company);
  }

  async deleteCompany(company: Company, navigateTo?: string): Promise<boolean> {
    const confirmed = await this.confirmService.confirm({
      title: 'companies.deleteTitle',
      message: 'companies.deleteMessage',
      confirmLabel: 'companies.deleteConfirm',
      params: {
        name: company.name,
        contacts: this.language.plural('companies.contactsCount', this.contacts.byCompany().get(company.id)?.length ?? 0),
        deals: this.language.plural('companies.dealsCount', this.deals.byCompany().get(company.id)?.length ?? 0),
      },
      tone: 'danger',
      onConfirm: () => this.crm.deleteCompany(company.id),
    });
    if (confirmed) {
      this.toast.success('companies.deleted');
      if (navigateTo) void this.router.navigateByUrl(navigateTo);
    }
    return confirmed;
  }

  // ── Activities ───────────────────────────────────────────────────────

  async toggleActivity(activity: Activity): Promise<void> {
    const completing = activity.completedAt === null;
    try {
      await this.crm.setActivityCompleted(activity.id, completing);
      this.toast.show({
        tone: 'success',
        title: completing ? 'activities.completed' : 'activities.reopened',
        action: completing
          ? { label: 'common.undo', run: async () => void (await this.crm.setActivityCompleted(activity.id, false)) }
          : undefined,
      });
    } catch {
      this.toast.error('errors.saveFailed');
    }
  }

  editActivity(activity: Activity): Promise<Activity | undefined> {
    return this.dialogs.activity({}, activity);
  }

  async deleteActivity(activity: Activity): Promise<boolean> {
    const confirmed = await this.confirmService.confirm({
      title: 'activities.deleteTitle',
      message: 'activities.deleteMessage',
      confirmLabel: 'activities.deleteConfirm',
      params: { subject: activity.subject },
      tone: 'danger',
      onConfirm: () => this.crm.deleteActivity(activity.id),
    });
    if (confirmed) this.toast.success('activities.deleted');
    return confirmed;
  }
}
