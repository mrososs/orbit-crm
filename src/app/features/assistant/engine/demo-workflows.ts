import { BaseEvent, EventType } from '@ag-ui/core';
import { DealStage } from '../../../core/models';
import { a2ui } from '../protocol/a2ui-transport';
import { AgentText, renderText, Translator } from '../protocol/agent-text';
import { RunEmitter } from '../protocol/run-emitter';
import { FixtureId, loadFixture } from '../scenarios';
import { AssistantAction, AssistantActionOf } from '../schemas/action.schemas';
import { DemoCommand, DemoCommandSchema } from '../schemas/command.schemas';
import { A2UI_VERSION, IntentId, ORBIT_CATALOG_ID } from '../schemas/constants';
import { fieldErrors, followUpInputSchema, moveRequestSchema } from '../schemas/domain.schemas';
import { RecordItem } from '../schemas/a2ui.schemas';
import { AssistantTools } from '../services/assistant-tools';
import { IntentMatch } from './intent-matcher';

/** What a run was asked to do, after input parsing. */
export type AgentRequest =
  | { kind: 'command'; command: DemoCommand; match?: IntentMatch }
  | { kind: 'action'; action: AssistantAction }
  | { kind: 'fallback'; text: string };

interface SurfaceRecord {
  surfaceId: string;
  /** The AG-UI activity message carrying this surface. */
  messageId: string;
  fixture: FixtureId;
  status: 'editing' | 'submitted' | 'cancelled' | 'pending' | 'confirmed' | 'open';
  /** Stage move awaiting confirmation; the confirm action must match it exactly. */
  pendingMove?: { dealId: string; stage: DealStage };
  scope?: 'mine' | 'team';
}

/** Agent memory, mirrored to the client as AG-UI state (STATE_SNAPSHOT / STATE_DELTA). */
interface AgentMemory {
  lastIntent: string | null;
  surfaces: Record<string, FixtureId>;
}

/**
 * The deterministic "brain" of the demo agent: one workflow per intent or user
 * action. Each workflow emits real AG-UI events (steps, streamed text, tool
 * calls, state, A2UI surfaces) and reads or writes CRM data only through
 * {@link AssistantTools}.
 */
export class DemoWorkflows {
  private readonly surfaces = new Map<string, SurfaceRecord>();
  private memory: AgentMemory = { lastIntent: null, surfaces: {} };
  private surfaceCount = 0;

  constructor(
    private readonly tools: AssistantTools,
    private readonly translator: Translator,
  ) {}

  reset(): void {
    this.surfaces.clear();
    this.memory = { lastIntent: null, surfaces: {} };
  }

  /** Surfaces this agent created (used by the client to clean up on reset). */
  surfaceIds(): string[] {
    return [...this.surfaces.keys()];
  }

  async handle(request: AgentRequest, run: RunEmitter): Promise<{ handled: string }> {
    run.stateSnapshot(this.memory);
    await this.tools.ready();

    if (request.kind === 'fallback') {
      this.remember(run, 'fallback');
      await this.say(run, { key: 'assistant.fallback.text' });
      await this.openSurface(run, 'capabilities', {});
      return { handled: 'fallback' };
    }
    if (request.kind === 'command') {
      if (request.match) {
        run.emit({
          type: EventType.CUSTOM,
          name: 'orbit.intent',
          value: { intent: request.match.intent, score: request.match.score, reason: request.match.reason },
        } as BaseEvent);
      }
      this.remember(run, request.command.intent);
      await this.command(request.command, run);
      return { handled: request.command.intent };
    }
    await this.action(request.action, run);
    return { handled: request.action.name };
  }

  // ── Commands ────────────────────────────────────────────────────────

  private async command(command: DemoCommand, run: RunEmitter): Promise<void> {
    switch (command.intent) {
      case 'salesOverview':
        return this.salesOverview(run);
      case 'topDeals':
        return this.topDeals(run, command.scope, command.limit);
      case 'overdueTasks':
        return this.overdueTasks(run);
      case 'createFollowUp':
        return this.followUpForm(run, { contactId: command.contactId, dealId: command.dealId });
      case 'dealsFilter':
        return this.dealsFilter(run, command.ownerId, command.stage);
      case 'moveDealStage':
        return this.moveForm(run, command.dealId);
      case 'help':
        await this.say(run, { key: 'assistant.help.text' });
        await this.openSurface(run, 'capabilities', {});
        return;
      case 'malformedDemo':
        return this.malformedDemo(run);
    }
  }

  private async salesOverview(run: RunEmitter): Promise<void> {
    await this.say(run, { key: 'assistant.overview.intro' });
    const data = await run.step('query_crm', () =>
      run.toolCall('crm.getSalesOverview', { period: 'dashboardDefault', scope: 'team' }, () => this.tools.salesOverview(), (r) => ({
        period: r.preset,
        revenue: r.revenue,
        openDeals: r.openDeals,
        overdue: r.overdue,
      })),
    );
    await run.step('render_surface', async () => {
      await this.openSurface(run, 'sales-overview', {
        rangeStart: data.rangeStart,
        rangeEnd: data.rangeEnd,
        kpis: {
          revenue: data.revenue,
          revenueChange: data.revenueChange,
          dealsWon: data.dealsWon,
          pipeline: data.pipeline,
          weighted: data.weighted,
          openDeals: data.openDeals,
          winRate: data.winRate,
          followUps: data.followUps,
          overdue: data.overdue,
        },
        stages: data.stages,
      });
    });
    await this.say(run, data.overdue > 0 ? { key: 'assistant.overview.outroOverdue', count: data.overdue } : { key: 'assistant.overview.outro' });
  }

  private async topDeals(run: RunEmitter, scope: 'mine' | 'team', limit: number): Promise<void> {
    await this.say(run, { key: scope === 'mine' ? 'assistant.deals.introMine' : 'assistant.deals.introTeam' });
    const data = await run.step('query_crm', () =>
      run.toolCall('crm.listOpenDeals', { scope, limit, sort: 'value_desc' }, () => this.tools.topOpenDeals(scope, limit), (r) => ({
        total: r.total,
        returned: r.items.length,
      })),
    );
    const record = await run.step('render_surface', () => this.openSurface(run, 'top-deals', this.dealListModel(data.scope, data)));
    record.scope = scope;
    await this.say(run, data.total === 0 ? { key: 'assistant.deals.none' } : { key: 'assistant.deals.outro', count: data.total });
  }

  private dealListModel(scope: 'mine' | 'team', data: { total: number; totalValue: number; items: RecordItem[] }) {
    return {
      countKey: scope === 'mine' ? 'assistant.deals.countMine' : 'assistant.deals.countTeam',
      toggleKey: scope === 'mine' ? 'assistant.deals.showTeam' : 'assistant.deals.showMine',
      otherScope: scope === 'mine' ? 'team' : 'mine',
      total: data.total,
      totalValue: data.totalValue,
      items: data.items,
    };
  }

  private async overdueTasks(run: RunEmitter): Promise<void> {
    await this.say(run, { key: 'assistant.overdue.intro' });
    const items = await run.step('query_crm', () =>
      run.toolCall('crm.listOverdueActivities', { dueBefore: this.tools.today(), status: 'open' }, () => this.tools.overdueActivities(), (r) => ({ count: r.length })),
    );
    await run.step('render_surface', () => this.openSurface(run, 'overdue-tasks', { total: items.length, items }));
    await this.say(run, items.length === 0 ? { key: 'assistant.overdue.none' } : { key: 'assistant.overdue.outro', count: items.length });
  }

  private async followUpForm(run: RunEmitter, prefill: { contactId?: string; dealId?: string }): Promise<void> {
    await this.say(run, { key: 'assistant.followUp.intro' });
    const options = await run.step('query_crm', () =>
      run.toolCall('crm.getFollowUpOptions', prefill, () => this.tools.followUpOptions(prefill), (r) => ({
        contacts: r.contacts.length,
        deals: r.deals.length,
        owners: r.owners.length,
      })),
    );
    await run.step('render_surface', async () => {
      const record = await this.openSurface(run, 'follow-up-form', {
        status: 'editing',
        today: this.tools.today(),
        form: options.defaults,
        errors: {},
        options: { contacts: options.contacts, deals: options.deals, owners: options.owners, priorities: options.priorities },
      });
      record.status = 'editing';
    });
  }

  private async dealsFilter(run: RunEmitter, ownerId: string, stage: DealStage | 'all'): Promise<void> {
    await this.say(run, { key: 'assistant.filters.intro' });
    const data = await run.step('query_crm', () =>
      run.toolCall('crm.filterDeals', { ownerId, stage }, () => this.tools.filterDeals(ownerId, stage), (r) => ({ total: r.total })),
    );
    await run.step('render_surface', () =>
      this.openSurface(run, 'deals-filter', {
        filters: { ownerId, stage },
        options: { owners: this.tools.ownerOptions(true), stages: this.tools.stageOptions(true) },
        total: data.total,
        totalValue: data.totalValue,
        items: data.items,
      }),
    );
    await this.say(run, { key: 'assistant.filters.outro' });
  }

  private async moveForm(run: RunEmitter, dealId?: string): Promise<void> {
    await this.say(run, { key: 'assistant.move.intro' });
    const deals = await run.step('query_crm', () =>
      run.toolCall('crm.listOpenDeals', { fields: ['id', 'name', 'stage'] }, () => this.tools.openDealOptions(), (r) => ({ count: r.length })),
    );
    await run.step('render_surface', async () => {
      const record = await this.openSurface(run, 'move-stage-form', {
        status: 'editing',
        form: { dealId: dealId && this.tools.hasOpenDeal(dealId) ? dealId : '', stage: '' },
        errors: {},
        options: { deals, stages: this.tools.stageOptions(false) },
      });
      record.status = 'editing';
    });
  }

  /** Sends a payload that the client must reject — demonstrates the Zod boundary. */
  private async malformedDemo(run: RunEmitter): Promise<void> {
    await this.say(run, { key: 'assistant.malformed.intro' });
    const surfaceId = `malformed-${++this.surfaceCount}`;
    run.surface([
      { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: ORBIT_CATALOG_ID } },
      {
        version: A2UI_VERSION,
        updateComponents: {
          surfaceId,
          components: [
            { id: 'root', component: 'HtmlEmbed', html: '<img src=x onerror="alert(1)">' },
            { id: 'run', component: 'Button', label: 'Run', action: { functionCall: { call: 'eval', args: { code: 'localStorage.clear()' } } } },
          ],
        },
      },
    ]);
    await this.say(run, { key: 'assistant.malformed.outro' });
  }

  // ── Actions ─────────────────────────────────────────────────────────

  private async action(action: AssistantAction, run: RunEmitter): Promise<void> {
    if (action.name === 'prompt.run') {
      // Surface buttons reuse the suggestion labels ("Show my biggest open deals").
      const command = DemoCommandSchema.parse({ intent: action.context.intent, ...(action.context.intent === 'topDeals' ? { scope: 'mine' } : {}) });
      this.remember(run, command.intent);
      return this.command(command, run);
    }
    const record = this.surfaces.get(action.surfaceId);
    if (!record) {
      await this.say(run, { key: 'assistant.errors.staleSurface' });
      return;
    }
    switch (action.name) {
      case 'dealList.scope':
        return this.changeScope(run, record, action.context.scope);
      case 'dealList.filter':
        return this.refreshFilter(run, record, action);
      case 'followUp.submit':
        return this.submitFollowUp(run, record, action);
      case 'followUp.cancel':
      case 'deal.cancelMove':
        return this.cancel(run, record, action.name === 'followUp.cancel' ? 'assistant.followUp.cancelled' : 'assistant.move.cancelled');
      case 'deal.startMove':
        return this.moveForm(run, action.context.dealId);
      case 'deal.reviewMove':
        return this.reviewMove(run, record, action);
      case 'deal.confirmMove':
        return this.confirmMove(run, record, action);
      case 'deal.undoMove':
        return this.undoMove(run, record, action.context.receiptId);
    }
  }

  private async changeScope(run: RunEmitter, record: SurfaceRecord, scope: 'mine' | 'team'): Promise<void> {
    if (record.fixture !== 'top-deals') return this.say(run, { key: 'assistant.errors.staleSurface' });
    const data = await run.toolCall('crm.listOpenDeals', { scope, limit: 6, sort: 'value_desc' }, () => this.tools.topOpenDeals(scope, 6), (r) => ({ total: r.total }));
    record.scope = scope;
    this.patch(run, record, this.dealListModel(scope, data));
  }

  private async refreshFilter(run: RunEmitter, record: SurfaceRecord, action: AssistantActionOf<'dealList.filter'>): Promise<void> {
    if (record.fixture !== 'deals-filter') return this.say(run, { key: 'assistant.errors.staleSurface' });
    const { ownerId, stage } = action.context;
    if (ownerId !== 'all' && !this.tools.hasMember(ownerId)) return this.say(run, { key: 'assistant.errors.invalidAction' });
    const data = await run.toolCall('crm.filterDeals', { ownerId, stage }, () => this.tools.filterDeals(ownerId, stage), (r) => ({ total: r.total }));
    this.patch(run, record, { total: data.total, totalValue: data.totalValue, items: data.items });
  }

  private async submitFollowUp(run: RunEmitter, record: SurfaceRecord, action: AssistantActionOf<'followUp.submit'>): Promise<void> {
    if (record.fixture !== 'follow-up-form' || record.status !== 'editing') return this.say(run, { key: 'assistant.errors.staleSurface' });
    this.patch(run, record, { status: 'submitting' });

    const parsed = await run.step('validate_input', async () => followUpInputSchema(this.tools).safeParse(action.context));
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      this.patch(run, record, { status: 'editing', errors });
      await this.say(run, { key: 'assistant.followUp.invalid', count: Object.keys(errors).length });
      return;
    }

    const created = await run.step('execute_command', () =>
      run.toolCall('crm.createActivity', { type: 'follow-up', ...parsed.data }, () => this.tools.createFollowUp(parsed.data), (r) => ({ id: r.id })),
    );
    record.status = 'submitted';
    this.patch(run, record, { status: 'submitted', errors: {} });
    await this.say(run, { key: 'assistant.followUp.done', params: { subject: created.subject } });
    const related = [
      ...(created.contact ? [{ kind: 'contact' as const, ...created.contact }] : []),
      ...(created.deal ? [{ kind: 'deal' as const, ...created.deal }] : []),
    ];
    const item: RecordItem = {
      id: created.id,
      title: created.subject,
      date: created.dueAt,
      dateKind: 'due',
      priority: parsed.data.priority,
      related,
    };
    await this.openSurface(run, 'follow-up-success', { dueAt: created.dueAt, created: [item] });
  }

  private async cancel(run: RunEmitter, record: SurfaceRecord, message: string): Promise<void> {
    if (record.status !== 'editing' && record.status !== 'pending') return;
    record.status = 'cancelled';
    record.pendingMove = undefined;
    this.patch(run, record, { status: 'cancelled' });
    await this.say(run, { key: message });
  }

  private async reviewMove(run: RunEmitter, record: SurfaceRecord, action: AssistantActionOf<'deal.reviewMove'>): Promise<void> {
    if (record.fixture !== 'move-stage-form' || record.status !== 'editing') return this.say(run, { key: 'assistant.errors.staleSurface' });
    const parsed = await run.step('validate_input', async () => moveRequestSchema(this.tools).safeParse(action.context));
    if (!parsed.success) {
      this.patch(run, record, { errors: fieldErrors(parsed.error) });
      await this.say(run, { key: 'assistant.move.invalid' });
      return;
    }
    const details = this.tools.moveDetails(parsed.data.dealId, parsed.data.stage);
    if (!details) return this.say(run, { key: 'assistant.errors.invalidAction' });
    record.status = 'submitted';
    this.patch(run, record, { status: 'submitted', errors: {} });

    await this.say(run, { key: 'assistant.move.reviewText' });
    const confirm = await this.openSurface(run, 'move-stage-confirm', {
      status: 'pending',
      move: { dealId: details.dealId, stage: details.toStage },
      details: [
        { labelKey: 'assistant.move.dealLabel', value: details.dealName },
        { labelKey: 'assistant.move.fromLabel', valueKey: `enums.stage.${details.fromStage}` },
        { labelKey: 'assistant.move.toLabel', valueKey: `enums.stage.${details.toStage}` },
        { labelKey: 'assistant.move.valueLabel', amount: details.value },
      ],
    });
    confirm.status = 'pending';
    confirm.pendingMove = { dealId: details.dealId, stage: details.toStage };
  }

  private async confirmMove(run: RunEmitter, record: SurfaceRecord, action: AssistantActionOf<'deal.confirmMove'>): Promise<void> {
    const pending = record.pendingMove;
    // The confirmation must be the one the agent issued, for exactly this deal and stage.
    if (record.fixture !== 'move-stage-confirm' || record.status !== 'pending' || !pending || pending.dealId !== action.context.dealId || pending.stage !== action.context.stage) {
      return this.say(run, { key: 'assistant.errors.invalidAction' });
    }
    record.status = 'confirmed';
    record.pendingMove = undefined;
    this.patch(run, record, { status: 'confirmed' });

    const result = await run.step('execute_command', () =>
      run.toolCall('crm.moveDeal', { dealId: pending.dealId, toStage: pending.stage }, () => this.tools.moveDeal(pending.dealId, pending.stage), (r) =>
        r ? { moved: true, from: r.details.fromStage, to: r.details.toStage } : { moved: false },
      ),
    );
    if (!result) return this.say(run, { key: 'assistant.errors.invalidAction' });
    const item = this.tools.dealRecord(pending.dealId);
    await this.say(run, {
      key: 'assistant.move.doneText',
      params: { deal: result.details.dealName, stage: { t: `enums.stage.${result.details.toStage}` } },
    });
    const done = await this.openSurface(run, 'move-stage-done', {
      titleKey: 'assistant.move.doneTitle',
      items: item ? [item] : [],
      receiptId: result.receiptId,
      dealId: pending.dealId,
      undone: false,
    });
    done.status = 'open';
  }

  private async undoMove(run: RunEmitter, record: SurfaceRecord, receiptId: string): Promise<void> {
    if (record.fixture !== 'move-stage-done') return this.say(run, { key: 'assistant.errors.staleSurface' });
    const details = await run.step('execute_command', () =>
      run.toolCall('crm.undoMove', { receiptId }, () => this.tools.undoMove(receiptId), (r) => ({ undone: !!r })),
    );
    if (!details) return this.say(run, { key: 'assistant.move.undoUnavailable' });
    const item = this.tools.dealRecord(details.dealId);
    this.patch(run, record, { undone: true, titleKey: 'assistant.move.undoneTitle', items: item ? [item] : [] });
    await this.say(run, { key: 'assistant.move.undoneText', params: { deal: details.dealName, stage: { t: `enums.stage.${details.fromStage}` } } });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async say(run: RunEmitter, text: AgentText): Promise<void> {
    await run.text(renderText(text, this.translator), text);
  }

  /** Creates a surface from a validated fixture and hydrates its data model. */
  private async openSurface(run: RunEmitter, fixture: FixtureId, data: object): Promise<SurfaceRecord> {
    const { components } = loadFixture(fixture);
    const surfaceId = `${fixture}-${++this.surfaceCount}`;
    const messageId = run.surface([a2ui.createSurface(surfaceId), a2ui.updateComponents(surfaceId, components), a2ui.updateDataModel(surfaceId, data)]);
    const record: SurfaceRecord = { surfaceId, messageId, fixture, status: 'open' };
    this.surfaces.set(surfaceId, record);
    this.memory.surfaces[surfaceId] = fixture;
    run.stateDelta([{ op: 'add', path: `/surfaces/${surfaceId}`, value: fixture }]);
    await run.pause();
    return record;
  }

  /** Appends data-model updates to an existing surface (one `updateDataModel` per key). */
  private patch(run: RunEmitter, record: SurfaceRecord, values: Record<string, unknown>): void {
    run.updateSurface(
      record.messageId,
      Object.entries(values).map(([key, value]) => a2ui.updateDataModel(record.surfaceId, value, `/${key}`)),
    );
  }

  private remember(run: RunEmitter, intent: IntentId | 'fallback'): void {
    this.memory.lastIntent = intent;
    run.stateDelta([{ op: 'replace', path: '/lastIntent', value: intent }]);
  }
}
