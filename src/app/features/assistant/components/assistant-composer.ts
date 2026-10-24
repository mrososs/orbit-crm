import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

const MAX_LENGTH = 500;

/** Message input: Enter sends, Shift+Enter adds a line; while a run streams, the button stops it. */
@Component({
  selector: 'app-assistant-composer',
  imports: [LucideDynamicIcon, TranslatePipe],
  template: `
    <form class="flex items-end gap-2" (submit)="submit($event)">
      <label class="sr-only" for="assistant-input">{{ 'assistant.composer.label' | translate }}</label>
      <textarea
        #input
        id="assistant-input"
        rows="1"
        class="control max-h-32 min-h-10 flex-1 resize-none py-2 leading-6"
        [maxLength]="maxLength"
        [placeholder]="'assistant.composer.placeholder' | translate"
        [value]="text()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        data-testid="assistant-input"
      ></textarea>
      @if (running()) {
        <button
          type="button"
          class="btn btn-secondary btn-icon size-10 shrink-0"
          [attr.aria-label]="'assistant.composer.stop' | translate"
          (click)="stop.emit()"
          data-testid="assistant-stop"
        >
          <svg lucideIcon="square" [size]="15" aria-hidden="true"></svg>
        </button>
      } @else {
        <button
          type="submit"
          class="btn btn-primary btn-icon size-10 shrink-0"
          [disabled]="!text().trim()"
          [attr.aria-label]="'assistant.composer.send' | translate"
          data-testid="assistant-send"
        >
          <svg lucideIcon="send-horizontal" [size]="16" class="rtl-flip" aria-hidden="true"></svg>
        </button>
      }
    </form>
    <p class="mt-1.5 text-2xs text-fg-subtle">{{ 'assistant.composer.hint' | translate }}</p>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantComposer {
  readonly running = input(false);
  readonly send = output<string>();
  readonly stop = output<void>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly text = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  focus(): void {
    this.input().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.text.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    const value = this.text().trim();
    if (!value || this.running()) return;
    this.send.emit(value);
    this.text.set('');
    this.input().nativeElement.style.height = 'auto';
  }
}
