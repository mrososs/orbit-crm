import { AgentSubscriber } from '@ag-ui/client';
import { EventSchemas } from '@ag-ui/core/schemas';
import { A2uiRendererService } from '@a2ui/angular';
import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { PreferencesService } from '../../../core/services/preferences.service';
import { createId } from '../../../shared/utils/id';
import { DemoWorkflows } from '../engine/demo-workflows';
import { IntentMatcher } from '../engine/intent-matcher';
import intentsJson from '../engine/intents.json';
import { A2UI_VERSION } from '../schemas/constants';
import { isAgentText } from '../protocol/agent-text';
import { OrbitDemoAgent } from '../protocol/orbit-agent';
import { I18N_METADATA_KEY, Pacing, REDUCED_MOTION_PACING, RELAXED_PACING } from '../protocol/run-emitter';
import { AssistantAction } from '../schemas/action.schemas';
import { A2uiActivityContentSchema, A2uiActivityPatchSchema } from '../schemas/a2ui.schemas';
import { DemoCommandInput, DemoCommandSchema, IntentCatalogSchema, IntentDefinition } from '../schemas/command.schemas';
import { formatIssues } from '../schemas/zod-issues';
import { AssistantStore } from '../state/assistant.store';
import { AssistantActionDispatcher } from './action-dispatcher';
import { AssistantTools } from './assistant-tools';

/** Overrides event pacing (tests use instant pacing). */
export const ASSISTANT_PACING = new InjectionToken<Pacing>('ASSISTANT_PACING');

/**
 * Local AG-UI transport adapter: runs the demo agent through the official
 * `@ag-ui/client` runtime and maps subscriber callbacks onto the chat store and
 * the A2UI renderer. The chat components only talk to this service — never to
 * CRM stores — so the agent could be replaced by a remote one here.
 */
@Injectable()
export class AssistantSession {
  private readonly store = inject(AssistantStore);
  private readonly renderer = inject(A2uiRendererService);
  private readonly tools = inject(AssistantTools);
  private readonly language = inject(LanguageService);
  private readonly prefs = inject(PreferencesService);
  private readonly pacingOverride = inject(ASSISTANT_PACING, { optional: true });

  private readonly workflows = new DemoWorkflows(this.tools, {
    t: (key, params) => this.language.t(key, params),
    plural: (key, count, params) => this.language.plural(key, count, params),
  });
  private readonly agent = new OrbitDemoAgent(
    {
      workflows: this.workflows,
      matcher: new IntentMatcher(loadIntents()),
      matchContext: () => ({ members: this.tools.teamMembers() }),
      pacing: () => this.pacingOverride ?? (this.reducedMotion() ? REDUCED_MOTION_PACING : RELAXED_PACING),
    },
    { threadId: createId('thread') },
  );
  /** Runs are serialized: an action arriving mid-run waits for the current run. */
  private queue: Promise<void> = Promise.resolve();
  private readonly renderedSurfaces = new Set<string>();

  constructor() {
    inject(AssistantActionDispatcher).connect({
      run: (action) => this.runAction(action),
      reject: (name, issues) => this.store.addNotice('assistant.errors.blockedAction', `${name}: ${issues.join('; ')}`),
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Sends a typed message, or a suggestion chip's structured command. */
  send(text: string, command?: DemoCommandInput): Promise<void> {
    const content = text.trim().slice(0, 500);
    if (!content) return Promise.resolve();
    const parsed = command ? DemoCommandSchema.safeParse(command) : null;
    this.agent.addMessage({ id: createId('user'), role: 'user', content });
    this.store.setMessages(this.agent.messages);
    return this.enqueue(parsed?.success ? 'suggestion' : 'message', parsed?.success ? { command: parsed.data } : undefined);
  }

  /** A validated A2UI user action, delivered as `forwardedProps.a2uiAction.userAction` (no new user message). */
  runAction(action: AssistantAction): Promise<void> {
    return this.enqueue(`action ${action.name}`, { a2uiAction: { userAction: action } });
  }

  /** Cancels the active run (the agent closes it with a `cancelled` outcome). */
  stop(): void {
    this.agent.abortRun();
  }

  /** Clears the conversation, agent memory and rendered surfaces, and starts a new thread. */
  reset(): void {
    this.stop();
    for (const surfaceId of this.renderedSurfaces) {
      try {
        this.renderer.processMessages([{ version: A2UI_VERSION, deleteSurface: { surfaceId } }]);
      } catch {
        // Already gone.
      }
    }
    this.renderedSurfaces.clear();
    this.workflows.reset();
    this.agent.setMessages([]);
    this.agent.setState({});
    this.agent.threadId = createId('thread');
    this.store.reset();
  }

  private enqueue(trigger: string, forwardedProps?: object): Promise<void> {
    const next = this.queue.then(() => this.execute(trigger, forwardedProps));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async execute(trigger: string, forwardedProps?: object): Promise<void> {
    const runId = createId('run');
    this.store.runStarted(runId, trigger);
    try {
      await this.agent.runAgent({ runId, forwardedProps }, this.subscriber(runId));
    } catch (error) {
      // Failures are reported through onRunFailed / onRunErrorEvent; keep the queue alive.
      if (this.store.currentRun()?.runId === runId) this.store.runEnded(runId, 'error', String(error));
    }
  }

  private subscriber(runId: string): AgentSubscriber {
    return {
      onRunStartedEvent: () => this.store.setConnecting(false),
      onEvent: ({ event }) => {
        this.store.logEvent(runId, event, EventSchemas.safeParse(event).success);
      },
      onTextMessageStartEvent: ({ event }) => {
        this.store.setStreaming(event.messageId);
        const i18n = (event.metadata as Record<string, unknown> | undefined)?.[I18N_METADATA_KEY];
        if (isAgentText(i18n)) this.store.setI18n(event.messageId, i18n);
      },
      onTextMessageEndEvent: () => this.store.setStreaming(null),
      onStepStartedEvent: ({ event }) => this.store.setStep(event.stepName),
      onStepFinishedEvent: () => this.store.setStep(null),
      onActivitySnapshotEvent: ({ event }) => this.renderSnapshot(event.messageId, event.content),
      onActivityDeltaEvent: ({ event }) => this.renderDelta(event.messageId, event.patch),
      onMessagesChanged: ({ messages }) => this.store.setMessages(messages),
      onStateChanged: ({ state }) => this.store.setAgentState(structuredClone(state)),
      onRunFinishedEvent: (params) => this.store.runEnded(runId, params.outcome === 'cancelled' ? 'cancelled' : 'success'),
      onRunErrorEvent: ({ event }) => this.store.runEnded(runId, 'error', event.message),
      onRunFailed: ({ error }) => this.store.runEnded(runId, 'error', error.message),
    };
  }

  /** A2UI payloads are validated against the Orbit allowlist before the renderer sees them. */
  private renderSnapshot(messageId: string, content: unknown): void {
    const parsed = A2uiActivityContentSchema.safeParse(content);
    if (!parsed.success) {
      this.store.reject(messageId, formatIssues(parsed.error));
      return;
    }
    this.process(messageId, parsed.data.a2ui_operations);
  }

  private renderDelta(messageId: string, patch: unknown): void {
    if (this.store.rejected()[messageId]) return;
    const parsed = A2uiActivityPatchSchema.safeParse(patch);
    if (!parsed.success) {
      this.store.reject(messageId, formatIssues(parsed.error));
      return;
    }
    this.process(
      messageId,
      parsed.data.map((op) => op.value),
    );
  }

  private process(messageId: string, operations: unknown[]): void {
    try {
      this.renderer.processMessages(operations);
      for (const op of operations) {
        const created = (op as { createSurface?: { surfaceId: string } }).createSurface;
        if (created) this.renderedSurfaces.add(created.surfaceId);
      }
    } catch (error) {
      this.store.reject(messageId, [error instanceof Error ? error.message : String(error)]);
    }
  }

  private reducedMotion(): boolean {
    return this.prefs.reduceMotion() || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
}

/** The intent catalogue is JSON; an invalid file degrades to the honest fallback instead of crashing. */
function loadIntents(): IntentDefinition[] {
  const parsed = IntentCatalogSchema.safeParse(intentsJson);
  if (parsed.success) return parsed.data;
  console.error('[Orbit CRM] Invalid intents.json — every request will use the fallback answer.', parsed.error.issues);
  return [];
}

