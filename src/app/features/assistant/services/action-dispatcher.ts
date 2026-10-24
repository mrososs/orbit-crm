import { Injectable } from '@angular/core';
import { AssistantAction, AssistantActionSchema } from '../schemas/action.schemas';
import { formatIssues } from '../schemas/zod-issues';

export interface DispatchTarget {
  /** A validated action, forwarded to the agent as a new AG-UI run. */
  run(action: AssistantAction): void;
  /** An action that failed validation; it is reported and never executed. */
  reject(name: string, issues: string[]): void;
}

/**
 * Receives every action A2UI surfaces dispatch (the renderer's `actionHandler`).
 *
 * Only actions that parse against the allowlisted {@link AssistantActionSchema}
 * reach the agent, and only the agent's allowlisted workflows can turn them
 * into CRM writes. The dispatcher itself never touches CRM state.
 */
@Injectable()
export class AssistantActionDispatcher {
  private target: DispatchTarget | null = null;

  connect(target: DispatchTarget): void {
    this.target = target;
  }

  dispatch(raw: unknown): void {
    const parsed = AssistantActionSchema.safeParse(raw);
    if (!parsed.success) {
      const name = typeof (raw as { name?: unknown })?.name === 'string' ? String((raw as { name: string }).name) : 'unknown';
      this.target?.reject(name, formatIssues(parsed.error));
      return;
    }
    this.target?.run(parsed.data);
  }
}
