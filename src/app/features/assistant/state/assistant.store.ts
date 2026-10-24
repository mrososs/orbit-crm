import { Message } from '@ag-ui/core';
import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { surfaceIdsOf } from '../protocol/a2ui-transport';
import { AgentText } from '../protocol/agent-text';
import { A2UI_ACTIVITY_TYPE } from '../schemas/constants';

/** A conversation entry as the chat renders it (derived from AG-UI messages). */
export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant' | 'surface';
  text: string;
  /** A2UI surfaces carried by an activity message. */
  surfaceIds: string[];
  /** Names of the tools an assistant message called. */
  tools: string[];
}

export interface LoggedEvent {
  seq: number;
  /** Milliseconds since the run started. */
  offset: number;
  type: string;
  payload: unknown;
  /** Result of validating the event against the official AG-UI event schemas. */
  valid: boolean;
}

export type RunStatus = 'running' | 'success' | 'cancelled' | 'error';

export interface RunLog {
  runId: string;
  trigger: string;
  startedAt: number;
  durationMs: number | null;
  status: RunStatus;
  error: string | null;
  events: LoggedEvent[];
}

interface AssistantState {
  messages: ChatMessageView[];
  runs: RunLog[];
  running: boolean;
  /** Waiting for the (simulated) network round-trip before the first event. */
  connecting: boolean;
  step: string | null;
  /** Message being streamed (shown raw until it ends). */
  streamingId: string | null;
  agentState: unknown;
  /** Activity messages whose A2UI payload failed validation, with the reasons. */
  rejected: Record<string, string[]>;
  /** Translation references of agent text messages, for re-localization. */
  i18n: Record<string, AgentText>;
  /** Client-side notices (e.g. a blocked action), keyed by id. */
  notices: { id: string; key: string; detail: string }[];
}

const MAX_RUNS = 15;
const MAX_EVENTS = 400;

const initialState: AssistantState = {
  messages: [],
  runs: [],
  running: false,
  connecting: false,
  step: null,
  streamingId: null,
  agentState: {},
  rejected: {},
  i18n: {},
  notices: [],
};

function toView(message: Message): ChatMessageView | null {
  switch (message.role) {
    case 'user':
      return { id: message.id, role: 'user', text: typeof message.content === 'string' ? message.content : '', surfaceIds: [], tools: [] };
    case 'assistant':
      return {
        id: message.id,
        role: 'assistant',
        text: message.content ?? '',
        surfaceIds: [],
        tools: (message.toolCalls ?? []).map((call) => call.function.name),
      };
    case 'activity':
      return message.activityType === A2UI_ACTIVITY_TYPE
        ? { id: message.id, role: 'surface', text: '', surfaceIds: surfaceIdsOf(message.content), tools: [] }
        : null;
    default:
      return null;
  }
}

/** Conversation, run and inspector state of the Interactive Demo Assistant. */
export const AssistantStore = signalStore(
  withState(initialState),
  withComputed((state) => ({
    isEmpty: computed(() => state.messages().length === 0),
    eventCount: computed(() => state.runs().reduce((sum, run) => sum + run.events.length, 0)),
    currentRun: computed(() => state.runs().find((run) => run.status === 'running') ?? null),
  })),
  withMethods((store) => ({
    setMessages(messages: readonly Message[]): void {
      patchState(store, { messages: messages.map(toView).filter((m): m is ChatMessageView => m !== null) });
    },
    runStarted(runId: string, trigger: string): void {
      const run: RunLog = { runId, trigger, startedAt: Date.now(), durationMs: null, status: 'running', error: null, events: [] };
      patchState(store, { running: true, connecting: true, step: null, runs: [run, ...store.runs()].slice(0, MAX_RUNS) });
    },
    logEvent(runId: string, event: { type: string }, valid: boolean): void {
      patchState(store, {
        runs: store.runs().map((run) =>
          run.runId === runId && run.events.length < MAX_EVENTS
            ? { ...run, events: [...run.events, { seq: run.events.length + 1, offset: Date.now() - run.startedAt, type: event.type, payload: event, valid }] }
            : run,
        ),
      });
    },
    runEnded(runId: string, status: Exclude<RunStatus, 'running'>, error: string | null = null): void {
      patchState(store, {
        running: false,
        connecting: false,
        step: null,
        streamingId: null,
        runs: store.runs().map((run) =>
          run.runId === runId && run.status === 'running' ? { ...run, status, error, durationMs: Date.now() - run.startedAt } : run,
        ),
      });
    },
    setConnecting(connecting: boolean): void {
      patchState(store, { connecting });
    },
    setStep(step: string | null): void {
      patchState(store, { step });
    },
    setStreaming(id: string | null): void {
      patchState(store, { streamingId: id });
    },
    setI18n(id: string, text: AgentText): void {
      patchState(store, { i18n: { ...store.i18n(), [id]: text } });
    },
    setAgentState(agentState: unknown): void {
      patchState(store, { agentState });
    },
    reject(messageId: string, issues: string[]): void {
      patchState(store, { rejected: { ...store.rejected(), [messageId]: issues } });
    },
    addNotice(key: string, detail: string): void {
      patchState(store, { notices: [...store.notices(), { id: `notice-${Date.now()}`, key, detail }].slice(-5) });
    },
    reset(): void {
      patchState(store, initialState);
    },
  })),
);

export type AssistantStore = InstanceType<typeof AssistantStore>;
