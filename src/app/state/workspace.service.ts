import { computed, inject, Injectable, signal } from '@angular/core';
import { CrmDatabase } from '../core/models';
import { WorkspaceInfo, WorkspaceRepository } from '../core/repositories/repositories';
import {
  ActivitiesStore,
  CompaniesStore,
  ContactsStore,
  DealsStore,
  TeamStore,
  TimelineStore,
} from './entity-stores';

export type WorkspaceStatus = 'loading' | 'ready' | 'error';

/** Demo workspace lifecycle: initial hydration, reset and export. */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly repository = inject(WorkspaceRepository);
  private readonly stores = [
    inject(TeamStore),
    inject(CompaniesStore),
    inject(ContactsStore),
    inject(DealsStore),
    inject(ActivitiesStore),
    inject(TimelineStore),
  ];

  private readonly _status = signal<WorkspaceStatus>('loading');
  private readonly _info = signal<WorkspaceInfo | null>(null);
  private pending: Promise<WorkspaceInfo> | null = null;

  readonly status = this._status.asReadonly();
  readonly info = this._info.asReadonly();
  readonly isReady = computed(() => this._status() === 'ready');

  /** Hydrates every store. Safe to call multiple times. */
  initialize(): Promise<WorkspaceInfo> {
    this.pending ??= this.hydrate();
    return this.pending;
  }

  async retry(): Promise<WorkspaceInfo> {
    this.pending = null;
    return this.initialize();
  }

  async reset(): Promise<WorkspaceInfo> {
    this._status.set('loading');
    await this.repository.reset();
    this.pending = this.hydrate();
    return this.pending;
  }

  exportSnapshot(): Promise<CrmDatabase> {
    return this.repository.exportSnapshot();
  }

  async refreshInfo(): Promise<void> {
    this._info.set(await this.repository.info());
  }

  private async hydrate(): Promise<WorkspaceInfo> {
    this._status.set('loading');
    try {
      await Promise.all(this.stores.map((store) => store.load()));
      const info = await this.repository.info();
      this._info.set(info);
      this._status.set('ready');
      return info;
    } catch (error) {
      this._status.set('error');
      this.pending = null;
      throw error;
    }
  }
}
