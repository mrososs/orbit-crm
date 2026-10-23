import { DialogRef } from '@angular/cdk/dialog';
import { inject, Injectable } from '@angular/core';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import type { CommandPalette } from './command-palette';

/** Opens the global search / command palette (⌘K / Ctrl+K). */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialogs = inject(DialogService);
  private ref: DialogRef<unknown, CommandPalette> | null = null;

  async open(): Promise<void> {
    if (this.ref) return;
    const { CommandPalette: Palette } = await import('./command-palette');
    this.ref = this.dialogs.open<unknown, unknown, CommandPalette>(Palette, { size: 'md' });
    this.ref.closed.subscribe(() => (this.ref = null));
  }
}
