import { BaseEvent, EventType, JsonPatchOperation } from '@ag-ui/core';
import { surfaceDelta, surfaceSnapshot } from './a2ui-transport';
import { AgentText } from './agent-text';

/**
 * Timing of a run. The agent is local, so latency is simulated to behave like
 * a remote agent: a request round-trip before the first event and backend time
 * for each CRM tool call. Tests use {@link INSTANT_PACING}.
 */
export interface Pacing {
  /** Pause between streamed text fragments. */
  readonly text: number;
  /** Pause between steps. */
  readonly step: number;
  /** Simulated network round-trip before `RUN_STARTED` (min, max ms). */
  readonly connect: readonly [number, number];
  /** Simulated backend time for each tool call (min, max ms). */
  readonly tool: readonly [number, number];
}

export const SIMULATED_NETWORK = { connect: [450, 950], tool: [350, 800] } as const;

export const RELAXED_PACING: Pacing = { text: 28, step: 180, ...SIMULATED_NETWORK };
/** Reduced motion: no typing effect, but the simulated network stays (it is not an animation). */
export const REDUCED_MOTION_PACING: Pacing = { text: 0, step: 0, ...SIMULATED_NETWORK };
export const INSTANT_PACING: Pacing = { text: 0, step: 0, connect: [0, 0], tool: [0, 0] };

/** A random duration within a range (simulated jitter). */
export function jitter([min, max]: readonly [number, number]): number {
  return max <= 0 ? 0 : Math.round(min + Math.random() * (max - min));
}

/** Thrown inside a workflow when the run was cancelled; the agent turns it into a cancelled outcome. */
export class RunCancelledError extends Error {
  constructor() {
    super('Run cancelled');
  }
}

export const I18N_METADATA_KEY = 'orbit.i18n';

let sequence = 0;
export const eventId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(++sequence).toString(36)}`;

/**
 * Writes protocol-valid AG-UI events for one run. It tracks open text messages,
 * tool calls and steps so a cancelled run can still be closed cleanly
 * (the AG-UI client rejects `RUN_FINISHED` while any of them is active).
 */
export class RunEmitter {
  private readonly openText = new Set<string>();
  private readonly openTools = new Set<string>();
  private readonly openSteps: string[] = [];

  constructor(
    private readonly sink: (event: BaseEvent) => void,
    private readonly signal: AbortSignal,
    private readonly pacing: Pacing,
  ) {}

  get cancelled(): boolean {
    return this.signal.aborted;
  }

  emit(event: BaseEvent): void {
    this.throwIfCancelled();
    this.sink({ ...event, timestamp: Date.now() });
  }

  async pause(ms = this.pacing.step): Promise<void> {
    if (ms > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        this.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    } else {
      // Still yield, so consumers render between events.
      await Promise.resolve();
    }
    this.throwIfCancelled();
  }

  /** `STEP_STARTED` … `STEP_FINISHED` around a unit of work. */
  async step<T>(stepName: string, work: () => Promise<T>): Promise<T> {
    this.emit({ type: EventType.STEP_STARTED, stepName } as BaseEvent);
    this.openSteps.push(stepName);
    const result = await work();
    this.openSteps.pop();
    this.emit({ type: EventType.STEP_FINISHED, stepName } as BaseEvent);
    return result;
  }

  /** Streams an assistant message word by word. */
  async text(content: string, i18n?: AgentText): Promise<string> {
    const messageId = eventId('msg');
    this.emit({
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role: 'assistant',
      ...(i18n ? { metadata: { [I18N_METADATA_KEY]: i18n } } : {}),
    } as BaseEvent);
    this.openText.add(messageId);
    for (const delta of chunkText(content)) {
      this.emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta } as BaseEvent);
      await this.pause(this.pacing.text);
    }
    this.openText.delete(messageId);
    this.emit({ type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent);
    return messageId;
  }

  /**
   * A tool call executed by the agent itself: arguments are streamed as JSON,
   * then `TOOL_CALL_RESULT` carries a summary of what the tool returned.
   */
  async toolCall<T>(toolCallName: string, args: object, run: () => T | Promise<T>, summarize: (result: T) => unknown = (r) => r): Promise<T> {
    const toolCallId = eventId('tool');
    this.emit({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName } as BaseEvent);
    this.openTools.add(toolCallId);
    for (const delta of chunkJson(JSON.stringify(args))) {
      this.emit({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta } as BaseEvent);
    }
    this.openTools.delete(toolCallId);
    this.emit({ type: EventType.TOOL_CALL_END, toolCallId } as BaseEvent);
    await this.pause(jitter(this.pacing.tool));
    const result = await run();
    this.emit({
      type: EventType.TOOL_CALL_RESULT,
      messageId: eventId('toolmsg'),
      toolCallId,
      role: 'tool',
      content: JSON.stringify(summarize(result) ?? null),
    } as BaseEvent);
    return result;
  }

  /** Sends a copy: the agent keeps updating its memory after the event is out, as a remote agent's serialized state would not. */
  stateSnapshot(snapshot: object): void {
    this.emit({ type: EventType.STATE_SNAPSHOT, snapshot: structuredClone(snapshot) } as BaseEvent);
  }

  stateDelta(delta: JsonPatchOperation[]): void {
    this.emit({ type: EventType.STATE_DELTA, delta } as BaseEvent);
  }

  /** Opens a new A2UI surface; returns the AG-UI activity message id. */
  surface(operations: readonly unknown[]): string {
    const messageId = eventId('surface');
    this.emit(surfaceSnapshot(messageId, operations) as BaseEvent);
    return messageId;
  }

  /** Appends A2UI operations to an existing surface's activity message. */
  updateSurface(messageId: string, operations: readonly unknown[]): void {
    this.emit(surfaceDelta(messageId, operations) as BaseEvent);
  }

  /** Closes whatever is still open after a cancellation (bypasses the cancellation check). */
  closeOpen(): void {
    for (const messageId of this.openText) this.sink({ type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now() } as BaseEvent);
    for (const toolCallId of this.openTools) this.sink({ type: EventType.TOOL_CALL_END, toolCallId, timestamp: Date.now() } as BaseEvent);
    for (const stepName of [...this.openSteps].reverse()) this.sink({ type: EventType.STEP_FINISHED, stepName, timestamp: Date.now() } as BaseEvent);
    this.openText.clear();
    this.openTools.clear();
    this.openSteps.length = 0;
  }

  private throwIfCancelled(): void {
    if (this.signal.aborted) throw new RunCancelledError();
  }
}

/** Word-sized fragments (keeps whitespace with the preceding word). */
export function chunkText(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

function chunkJson(json: string, size = 32): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += size) chunks.push(json.slice(i, i + size));
  return chunks.length ? chunks : ['{}'];
}
