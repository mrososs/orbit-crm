import { AbstractAgent, AgentConfig } from '@ag-ui/client';
import { BaseEvent, EventType, Message, RunAgentInput } from '@ag-ui/core';
import { Observable } from 'rxjs';
import { AgentRequest, DemoWorkflows } from '../engine/demo-workflows';
import { IntentMatcher, MatchContext } from '../engine/intent-matcher';
import { DemoCommandSchema, ForwardedPropsSchema } from '../schemas/command.schemas';
import { jitter, Pacing, RunCancelledError, RunEmitter } from './run-emitter';

export interface OrbitAgentDependencies {
  workflows: DemoWorkflows;
  matcher: IntentMatcher;
  matchContext: () => MatchContext;
  pacing: () => Pacing;
}

/** Input that failed validation at the agent boundary. */
export class InvalidRequestError extends Error {}

/**
 * A deterministic, browser-local AG-UI agent.
 *
 * It extends the official `AbstractAgent` from `@ag-ui/client`, so the client
 * runtime handles what a remote agent would get: event verification, message
 * and state application, subscriber notifications. Only the transport is
 * local — `run()` emits events from in-process workflows instead of an HTTP
 * stream. Swapping it for `HttpAgent` pointing at a real agent leaves the chat
 * UI and the A2UI renderer unchanged.
 */
export class OrbitDemoAgent extends AbstractAgent {
  private controller: AbortController | null = null;

  constructor(
    private readonly deps: OrbitAgentDependencies,
    config: AgentConfig = {},
  ) {
    super({ agentId: 'orbit-demo-agent', description: 'Deterministic Orbit CRM demo agent (no language model)', ...config });
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const controller = new AbortController();
      this.controller = controller;
      const { threadId, runId } = input;
      const emitter = new RunEmitter((event) => subscriber.next(event), controller.signal, this.deps.pacing());
      const end = (event: BaseEvent) => {
        subscriber.next({ ...event, timestamp: Date.now() } as BaseEvent);
        subscriber.complete();
      };

      void (async () => {
        // Simulated request round-trip: a remote agent's first event is never instant.
        await sleep(jitter(this.deps.pacing().connect), controller.signal);
        subscriber.next({ type: EventType.RUN_STARTED, threadId, runId, timestamp: Date.now() } as BaseEvent);
        try {
          if (controller.signal.aborted) throw new RunCancelledError();
          const request = this.parseRequest(input);
          const result = await this.deps.workflows.handle(request, emitter);
          end({ type: EventType.RUN_FINISHED, threadId, runId, outcome: { type: 'success' }, result } as BaseEvent);
        } catch (error) {
          emitter.closeOpen();
          if (controller.signal.aborted || error instanceof RunCancelledError) {
            end({ type: EventType.RUN_FINISHED, threadId, runId, outcome: { type: 'cancelled' } } as BaseEvent);
          } else {
            const code = error instanceof InvalidRequestError ? 'INVALID_INPUT' : (error as { fixtureId?: string }).fixtureId ? 'INVALID_FIXTURE' : 'WORKFLOW_ERROR';
            end({ type: EventType.RUN_ERROR, code, message: error instanceof Error ? error.message : String(error) } as BaseEvent);
          }
        } finally {
          if (this.controller === controller) this.controller = null;
        }
      })();

      return () => controller.abort();
    });
  }

  /** Cancels the active run; it ends with `RUN_FINISHED` and a `cancelled` outcome. */
  override abortRun(): void {
    this.controller?.abort();
    super.abortRun();
  }

  /** Validates `forwardedProps` with Zod, or routes the latest user message through the intent matcher. */
  private parseRequest(input: RunAgentInput): AgentRequest {
    if (input.forwardedProps !== undefined && input.forwardedProps !== null && Object.keys(input.forwardedProps).length > 0) {
      const props = ForwardedPropsSchema.safeParse(input.forwardedProps);
      if (!props.success) throw new InvalidRequestError(`Rejected forwardedProps: ${props.error.issues.map((i) => i.message).join('; ')}`);
      if (props.data.a2uiAction) return { kind: 'action', action: props.data.a2uiAction.userAction };
      if (props.data.command) return { kind: 'command', command: props.data.command };
    }
    const text = lastUserText(input.messages);
    if (!text) throw new InvalidRequestError('No user message to answer');
    const match = this.deps.matcher.match(text, this.deps.matchContext());
    if (!match) return { kind: 'fallback', text };
    const command = DemoCommandSchema.safeParse(match.command);
    if (!command.success) throw new InvalidRequestError('Matched intent produced an invalid command');
    return { kind: 'command', command: command.data, match };
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function lastUserText(messages: readonly Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') return typeof message.content === 'string' ? message.content.slice(0, 500) : '';
  }
  return '';
}
