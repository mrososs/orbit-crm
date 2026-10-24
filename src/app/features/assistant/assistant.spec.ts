import { A2UI_RENDERER_CONFIG, A2uiRendererService } from '@a2ui/angular';
import { BaseEvent, EventType } from '@ag-ui/core';
import { EventSchemas } from '@ag-ui/core/schemas';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { setupWorkspace } from '../../../testing/test-providers';
import { LanguageService } from '../../core/i18n/language.service';
import { CLOCK } from '../../core/services/platform';
import { ActivitiesStore, ContactsStore, DealsStore } from '../../state/entity-stores';
import { SurfaceSlot } from './components/surface-slot';
import { DemoWorkflows } from './engine/demo-workflows';
import { IntentMatcher, normalizeText } from './engine/intent-matcher';
import intentsJson from './engine/intents.json';
import { renderText } from './protocol/agent-text';
import { OrbitDemoAgent } from './protocol/orbit-agent';
import { INSTANT_PACING, Pacing } from './protocol/run-emitter';
import { createOrbitCatalog } from './renderer/orbit-catalog';
import { loadFixture, RAW_FIXTURES } from './scenarios';
import { A2uiActivityContentSchema } from './schemas/a2ui.schemas';
import { AssistantActionSchema } from './schemas/action.schemas';
import { ForwardedPropsSchema, IntentCatalogSchema } from './schemas/command.schemas';
import { A2UI_VERSION, ORBIT_CATALOG_ID } from './schemas/constants';
import { fieldErrors, followUpInputSchema, RecordLookup } from './schemas/domain.schemas';
import { AssistantActionDispatcher } from './services/action-dispatcher';
import { ASSISTANT_PACING, AssistantSession } from './services/assistant-session';
import { AssistantTools, CrmAssistantTools } from './services/assistant-tools';
import { AssistantStore } from './state/assistant.store';

const intents = IntentCatalogSchema.parse(intentsJson);
const TEAM = [
  { id: 'tm_alex', firstName: 'Alex', lastName: 'Morgan' },
  { id: 'tm_priya', firstName: 'Priya', lastName: 'Nair' },
];

async function setupAssistant(): Promise<void> {
  await setupWorkspace({}, [
    provideRouter([]),
    AssistantStore,
    AssistantActionDispatcher,
    { provide: AssistantTools, useClass: CrmAssistantTools },
    {
      provide: A2UI_RENDERER_CONFIG,
      useFactory: () => {
        const dispatcher = inject(AssistantActionDispatcher);
        return {
          catalogs: [createOrbitCatalog(inject(LanguageService), inject(CLOCK))],
          actionHandler: (action: unknown) => dispatcher.dispatch(action),
        };
      },
    },
    A2uiRendererService,
    AssistantSession,
    { provide: ASSISTANT_PACING, useValue: INSTANT_PACING },
  ]);
}

const op = (body: object) => ({ version: A2UI_VERSION, ...body });
const action = (name: string, context: object, surfaceId = 'follow-up-form-1') => ({
  name,
  surfaceId,
  sourceComponentId: 'form',
  timestamp: new Date().toISOString(),
  context,
});

describe('Assistant schemas (Zod)', () => {
  it('validates every scenario fixture and the intent catalogue', () => {
    for (const id of Object.keys(RAW_FIXTURES) as (keyof typeof RAW_FIXTURES)[]) {
      expect(() => loadFixture(id), id).not.toThrow();
    }
    expect(IntentCatalogSchema.safeParse(intentsJson).success).toBe(true);
  });

  it('accepts a well-formed A2UI v0.9.1 activity payload', () => {
    const content = {
      a2ui_operations: [
        op({ createSurface: { surfaceId: 'demo-1', catalogId: ORBIT_CATALOG_ID } }),
        op({ updateComponents: { surfaceId: 'demo-1', components: [{ id: 'root', component: 'Text', text: { call: 't', args: { key: 'assistant.title' } } }] } }),
        op({ updateDataModel: { surfaceId: 'demo-1', path: '/total', value: 3 } }),
      ],
    };
    expect(A2uiActivityContentSchema.safeParse(content).success).toBe(true);
  });

  it.each([
    ['an unknown component', { id: 'root', component: 'HtmlEmbed', html: '<img onerror=alert(1)>' }],
    ['an unknown prop', { id: 'root', component: 'Text', text: 'Hi', onclick: 'x' }],
    ['a function outside the allowlist', { id: 'root', component: 'Text', text: { call: 'eval', args: { code: '1' } } }],
    ['a client-side functionCall action', { id: 'root', component: 'Button', label: 'Go', action: { functionCall: { call: 'openUrl', args: {} } } }],
    ['an action outside the allowlist', { id: 'root', component: 'Button', label: 'Go', action: { event: { name: 'crm.deleteAll' } } }],
    ['a translation key outside the allowed namespaces', { id: 'root', component: 'Text', text: { call: 't', args: { key: 'secrets.apiKey' } } }],
  ])('rejects %s', (_label, component) => {
    const content = { a2ui_operations: [op({ updateComponents: { surfaceId: 'demo-1', components: [component] } })] };
    expect(A2uiActivityContentSchema.safeParse(content).success).toBe(false);
  });

  it('rejects other catalogs, other protocol versions and oversized data', () => {
    const foreign = { a2ui_operations: [op({ createSurface: { surfaceId: 'demo-1', catalogId: 'https://evil.example/catalog.json' } })] };
    const v08 = { a2ui_operations: [{ version: 'v0.8', createSurface: { surfaceId: 'demo-1', catalogId: ORBIT_CATALOG_ID } }] };
    const huge = { a2ui_operations: [op({ updateDataModel: { surfaceId: 'demo-1', value: 'x'.repeat(200_000) } })] };
    expect(A2uiActivityContentSchema.safeParse(foreign).success).toBe(false);
    expect(A2uiActivityContentSchema.safeParse(v08).success).toBe(false);
    expect(A2uiActivityContentSchema.safeParse(huge).success).toBe(false);
  });

  it('allowlists user actions and their arguments', () => {
    expect(AssistantActionSchema.safeParse(action('deal.confirmMove', { dealId: 'dl_014', stage: 'won' })).success).toBe(true);
    expect(AssistantActionSchema.safeParse(action('crm.deleteAll', {})).success).toBe(false);
    expect(AssistantActionSchema.safeParse(action('deal.confirmMove', { dealId: '../etc', stage: 'won' })).success).toBe(false);
    expect(AssistantActionSchema.safeParse(action('deal.confirmMove', { dealId: 'dl_014', stage: 'won', extra: 1 })).success).toBe(false);
    expect(AssistantActionSchema.safeParse(action('deal.undoMove', { receiptId: 'anything' })).success).toBe(false);
    expect(ForwardedPropsSchema.safeParse({ command: { intent: 'salesOverview' }, debug: true }).success).toBe(false);
  });

  it('validates follow-up input against CRM records', () => {
    const lookup: RecordLookup = {
      today: () => '2026-06-15',
      hasMember: (id) => id === 'tm_alex',
      hasContact: (id) => id === 'ct_001',
      hasOpenDeal: (id) => id === 'dl_014',
      dealStage: () => 'proposal',
    };
    const schema = followUpInputSchema(lookup);
    const valid = { subject: 'Call back', dueDate: '2026-06-16', dueTime: '10:00', priority: 'high', ownerId: 'tm_alex', contactId: 'ct_001', dealId: '' };
    expect(schema.safeParse(valid).success).toBe(true);

    const result = schema.safeParse({ ...valid, subject: 'Hi', dueDate: '2026-06-01', contactId: 'ct_999' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result.error!)).toEqual({
      subject: 'validation.subjectLength',
      dueDate: 'assistant.validation.pastDate',
      contactId: 'assistant.validation.unknownRecord',
    });
    const unlinked = schema.safeParse({ ...valid, contactId: '', dealId: '' });
    expect(fieldErrors(unlinked.error!)).toEqual({ contactId: 'assistant.validation.linkRecord' });
  });
});

describe('Deterministic intent routing', () => {
  const matcher = new IntentMatcher(intents);
  const match = (text: string) => matcher.match(text, { members: TEAM });

  it.each([
    ['Show me the sales overview', 'salesOverview'],
    ['Show my biggest open deals', 'topDeals'],
    ['What tasks are overdue?', 'overdueTasks'],
    ['Create a follow-up task', 'createFollowUp'],
    ["Montre-moi l'aperçu des ventes", 'salesOverview'],
    ['Quelles tâches sont en retard ?', 'overdueTasks'],
    ['اعرض أكبر صفقاتي المفتوحة', 'topDeals'],
    ['انشئ مهمه متابعه', 'createFollowUp'],
    ['could you add a reminder task for tomorrow', 'createFollowUp'],
    ['help', 'help'],
  ])('routes "%s" to %s', (text, intent) => {
    expect(match(text)?.intent).toBe(intent);
  });

  it('extracts scope, limit, owner and stage parameters', () => {
    expect(match('Show my biggest open deals')?.command).toEqual({ intent: 'topDeals', scope: 'mine', limit: 6 });
    expect(match('top 3 deals')?.command).toEqual({ intent: 'topDeals', scope: 'team', limit: 3 });
    expect(match("Show Priya's deals in negotiation")?.command).toEqual({ intent: 'dealsFilter', ownerId: 'tm_priya', stage: 'negotiation' });
    expect(match('الصفقات الرابحة')?.command).toEqual({ intent: 'dealsFilter', ownerId: 'all', stage: 'won' });
  });

  it('normalizes accents, Arabic diacritics and letter variants', () => {
    expect(normalizeText('Aperçu  DES Ventes!')).toBe('apercu des ventes');
    expect(normalizeText('أَنشِئ مُهِمَّة')).toBe(normalizeText('انشئ مهمه'));
    expect(normalizeText('أكبر ٣ صفقات')).toBe('اكبر 3 صفقات');
  });

  it('returns no match for requests outside the demo instead of guessing', () => {
    expect(match("What's the weather in Paris?")).toBeNull();
    expect(match('Write me a poem')).toBeNull();
  });
});

describe('AG-UI demo agent', () => {
  let tools: AssistantTools;

  beforeEach(async () => {
    await setupAssistant();
    tools = TestBed.inject(AssistantTools);
  });

  function createAgent(pacing: Pacing = INSTANT_PACING): OrbitDemoAgent {
    const language = TestBed.inject(LanguageService);
    return new OrbitDemoAgent(
      {
        workflows: new DemoWorkflows(tools, { t: (k, p) => language.t(k, p), plural: (k, c, p) => language.plural(k, c, p) }),
        matcher: new IntentMatcher(intents),
        matchContext: () => ({ members: tools.teamMembers() }),
        pacing: () => pacing,
      },
      { threadId: 'thread_test' },
    );
  }

  async function run(agent: OrbitDemoAgent, text: string, onEvent?: (e: BaseEvent) => void): Promise<BaseEvent[]> {
    const events: BaseEvent[] = [];
    agent.addMessage({ id: `user_${agent.messages.length}`, role: 'user', content: text });
    await agent.runAgent({ runId: `run_${agent.messages.length}` }, {
      onEvent: ({ event }) => {
        events.push(event);
        onEvent?.(event);
      },
    });
    return events;
  }

  it('emits a protocol-valid, correctly ordered run', async () => {
    const agent = createAgent();
    const events = await run(agent, 'Show me the sales overview');
    const types = events.map((e) => e.type);

    expect(types[0]).toBe(EventType.RUN_STARTED);
    expect(types.at(-1)).toBe(EventType.RUN_FINISHED);
    expect((events.at(-1) as unknown as { outcome: { type: string } }).outcome.type).toBe('success');
    expect(events.every((e) => EventSchemas.safeParse(e).success)).toBe(true);

    // Text messages: START, CONTENT…, END — never interleaved.
    let open: string | null = null;
    for (const e of events as unknown as { type: string; messageId?: string }[]) {
      if (e.type === 'TEXT_MESSAGE_START') {
        expect(open).toBeNull();
        open = e.messageId!;
      } else if (e.type === 'TEXT_MESSAGE_CONTENT') {
        expect(e.messageId).toBe(open);
      } else if (e.type === 'TEXT_MESSAGE_END') {
        expect(e.messageId).toBe(open);
        open = null;
      }
    }
    // Tool calls: START → ARGS… → END → RESULT.
    const tool = types.indexOf(EventType.TOOL_CALL_START);
    expect(types.slice(tool, types.indexOf(EventType.TOOL_CALL_RESULT) + 1)).toEqual([
      'TOOL_CALL_START',
      ...types.slice(tool + 1, types.indexOf(EventType.TOOL_CALL_END)).map(() => 'TOOL_CALL_ARGS'),
      'TOOL_CALL_END',
      'TOOL_CALL_RESULT',
    ]);
    // The A2UI surface travels in an ACTIVITY_SNAPSHOT that passes the client allowlist.
    const snapshot = events.find((e) => e.type === EventType.ACTIVITY_SNAPSHOT) as unknown as { activityType: string; content: unknown };
    expect(snapshot.activityType).toBe('a2ui-surface');
    expect(A2uiActivityContentSchema.safeParse(snapshot.content).success).toBe(true);
    expect(agent.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant', 'tool', 'activity', 'assistant']);
    expect(agent.state).toMatchObject({ lastIntent: 'salesOverview' });
  });

  it('sends state snapshots that later runs do not change', async () => {
    const agent = createAgent();
    await run(agent, 'Show me the sales overview');
    const first = (await run(agent, 'top 3 deals')).find((e) => e.type === EventType.STATE_SNAPSHOT) as unknown as { snapshot: { lastIntent: string; surfaces: object } };
    const sent = structuredClone(first.snapshot);
    await run(agent, 'What tasks are overdue?');
    expect(first.snapshot).toEqual(sent);
    expect(first.snapshot.lastIntent).toBe('salesOverview');
  });

  it('reports the same KPIs as the dashboard definitions', async () => {
    const agent = createAgent();
    const events = await run(agent, 'Show me the sales overview');
    const snapshot = events.find((e) => e.type === EventType.ACTIVITY_SNAPSHOT) as unknown as { content: { a2ui_operations: { updateDataModel?: { value: { kpis: object } } }[] } };
    const model = snapshot.content.a2ui_operations.find((o) => o.updateDataModel)!.updateDataModel!.value;
    const overview = tools.salesOverview();
    expect(model.kpis).toEqual(expect.objectContaining({ revenue: overview.revenue, pipeline: overview.pipeline, openDeals: overview.openDeals, overdue: overview.overdue }));
  });

  it('cancels mid-stream and still closes the run cleanly', async () => {
    const agent = createAgent({ text: 5, step: 5, connect: [0, 0], tool: [0, 0] });
    const events = await run(agent, 'Show me the sales overview', (e) => {
      if (e.type === EventType.TEXT_MESSAGE_CONTENT) agent.abortRun();
    });
    const last = events.at(-1) as unknown as { type: string; outcome: { type: string } };
    expect(last.type).toBe(EventType.RUN_FINISHED);
    expect(last.outcome.type).toBe('cancelled');
    expect(events.filter((e) => e.type === EventType.TEXT_MESSAGE_START).length).toBe(events.filter((e) => e.type === EventType.TEXT_MESSAGE_END).length);
    expect(events.some((e) => e.type === EventType.ACTIVITY_SNAPSHOT)).toBe(false);
  });

  it('simulates network latency before the first event and for each tool call', async () => {
    const agent = createAgent({ text: 0, step: 0, connect: [60, 60], tool: [40, 40] });
    const at: Record<string, number> = {};
    const started = Date.now();
    await run(agent, 'What tasks are overdue?', (e) => (at[e.type] ??= Date.now()));
    expect(at[EventType.RUN_STARTED] - started).toBeGreaterThanOrEqual(55);
    expect(at[EventType.TOOL_CALL_RESULT] - at[EventType.TOOL_CALL_END]).toBeGreaterThanOrEqual(35);
  });

  it('closes a run stopped during the simulated connection as cancelled', async () => {
    const agent = createAgent({ text: 0, step: 0, connect: [200, 200], tool: [0, 0] });
    const pending = run(agent, 'Show me the sales overview');
    setTimeout(() => agent.abortRun(), 20);
    const events = await pending;
    expect(events.map((e) => e.type)).toEqual([EventType.RUN_STARTED, EventType.RUN_FINISHED]);
    expect((events[1] as unknown as { outcome: { type: string } }).outcome.type).toBe('cancelled');
  });

  it('ends with RUN_ERROR when forwarded input fails validation', async () => {
    const agent = createAgent();
    const events: BaseEvent[] = [];
    await agent.runAgent({ runId: 'run_bad', forwardedProps: { command: { intent: 'dropDatabase' } } }, { onEvent: ({ event }) => void events.push(event) });
    const last = events.at(-1) as unknown as { type: string; code: string };
    expect(last.type).toBe(EventType.RUN_ERROR);
    expect(last.code).toBe('INVALID_INPUT');
  });

  it('answers unknown requests honestly with the supported options', async () => {
    const agent = createAgent();
    const events = await run(agent, 'Book me a flight to Rome');
    const text = agent.messages.filter((m) => m.role === 'assistant').map((m) => m.content).join(' ');
    expect(text).toContain("I'm a rules-based demo, so I didn't recognise that request");
    const snapshot = events.find((e) => e.type === EventType.ACTIVITY_SNAPSHOT) as unknown as { content: { a2ui_operations: { createSurface?: { surfaceId: string } }[] } };
    expect(snapshot.content.a2ui_operations[0].createSurface?.surfaceId).toMatch(/^capabilities-/);
  });
});

describe('Assistant session — CRM actions, rendering and localization', () => {
  let session: AssistantSession;
  let store: AssistantStore;
  let renderer: A2uiRendererService;

  beforeEach(async () => {
    await setupAssistant();
    session = TestBed.inject(AssistantSession);
    store = TestBed.inject(AssistantStore);
    renderer = TestBed.inject(A2uiRendererService);
  });

  const lastSurfaceId = () => store.messages().filter((m) => m.role === 'surface').at(-1)!.surfaceIds[0];
  const dataOf = (surfaceId: string, path: string) => renderer.surfaceGroup.getSurface(surfaceId)?.dataModel.get(path);
  const texts = () => store.messages().filter((m) => m.role === 'assistant' && m.text).map((m) => m.text);

  it('creates a follow-up through CrmService only after valid input', async () => {
    const activities = TestBed.inject(ActivitiesStore);
    const contact = TestBed.inject(ContactsStore).sorted()[0];
    const before = activities.entities().length;

    await session.send('Create a follow-up task', { intent: 'createFollowUp' });
    const formId = lastSurfaceId();
    expect(formId).toMatch(/^follow-up-form-/);
    expect((dataOf(formId, '/options/contacts') as unknown[]).length).toBeGreaterThan(50);

    const form = { subject: 'x', dueDate: '2026-06-16', dueTime: '10:00', priority: 'medium', ownerId: 'tm_alex', contactId: '', dealId: '' };
    await session.runAction(AssistantActionSchema.parse(action('followUp.submit', form, formId)));
    expect(activities.entities().length).toBe(before);
    expect(dataOf(formId, '/errors/subject')).toBe('validation.subjectLength');
    expect(dataOf(formId, '/errors/contactId')).toBe('assistant.validation.linkRecord');
    expect(dataOf(formId, '/status')).toBe('editing');

    await session.runAction(AssistantActionSchema.parse(action('followUp.submit', { ...form, subject: 'Call about the renewal', contactId: contact.id }, formId)));
    expect(activities.entities().length).toBe(before + 1);
    const created = activities.entities().find((a) => a.subject === 'Call about the renewal')!;
    expect(created).toMatchObject({ type: 'follow-up', contactId: contact.id, ownerId: 'tm_alex', completedAt: null });
    expect(dataOf(formId, '/status')).toBe('submitted');
    expect(lastSurfaceId()).toMatch(/^follow-up-success-/);
  });

  it('moves a deal only after an explicit, matching confirmation — and undoes it', async () => {
    const deals = TestBed.inject(DealsStore);
    const deal = deals.openDeals().find((d) => d.stage === 'proposal')!;

    await session.send('Update a deal stage', { intent: 'moveDealStage', dealId: deal.id });
    const formId = lastSurfaceId();
    expect(dataOf(formId, '/form/dealId')).toBe(deal.id);

    await session.runAction(AssistantActionSchema.parse(action('deal.reviewMove', { dealId: deal.id, stage: 'proposal' }, formId)));
    expect(dataOf(formId, '/errors/stage')).toBe('assistant.validation.sameStage');

    await session.runAction(AssistantActionSchema.parse(action('deal.reviewMove', { dealId: deal.id, stage: 'negotiation' }, formId)));
    const confirmId = lastSurfaceId();
    expect(confirmId).toMatch(/^move-stage-confirm-/);
    expect(deals.entityMap()[deal.id].stage).toBe('proposal');

    // A forged confirmation for another stage is refused.
    await session.runAction(AssistantActionSchema.parse(action('deal.confirmMove', { dealId: deal.id, stage: 'won' }, confirmId)));
    expect(deals.entityMap()[deal.id].stage).toBe('proposal');
    expect(texts().at(-1)).toContain("doesn't match anything I prepared");

    await session.runAction(AssistantActionSchema.parse(action('deal.confirmMove', { dealId: deal.id, stage: 'negotiation' }, confirmId)));
    expect(deals.entityMap()[deal.id].stage).toBe('negotiation');
    const doneId = lastSurfaceId();
    const receiptId = dataOf(doneId, '/receiptId') as string;

    await session.runAction(AssistantActionSchema.parse(action('deal.undoMove', { receiptId }, doneId)));
    expect(deals.entityMap()[deal.id].stage).toBe('proposal');
    expect(dataOf(doneId, '/undone')).toBe(true);
  });

  it('refreshes a filtered list in place when a filter changes', async () => {
    await session.send('Show deals by owner', { intent: 'dealsFilter' });
    const id = lastSurfaceId();
    const all = dataOf(id, '/total') as number;
    await session.runAction(AssistantActionSchema.parse(action('dealList.filter', { ownerId: 'tm_priya', stage: 'all' }, id)));
    const priya = TestBed.inject(DealsStore).openDeals().filter((d) => d.ownerId === 'tm_priya').length;
    expect(dataOf(id, '/total')).toBe(priya);
    expect(priya).toBeLessThan(all);
    expect(store.messages().filter((m) => m.role === 'surface').length).toBe(1);
  });

  it('blocks actions outside the allowlist before they reach the agent', () => {
    const runs = store.runs().length;
    TestBed.inject(AssistantActionDispatcher).dispatch(action('crm.deleteAll', {}));
    expect(store.runs().length).toBe(runs);
    expect(store.notices()[0].detail).toContain('crm.deleteAll');
  });

  it('never renders a malformed payload', async () => {
    await session.send('simulate a malformed payload');
    const message = store.messages().find((m) => m.role === 'surface')!;
    expect(store.rejected()[message.id]?.join(' ')).toContain('Invalid discriminator value');
    expect(renderer.surfaceGroup.getSurface(message.surfaceIds[0])).toBeUndefined();
  });

  it('renders surfaces with the Orbit catalog and follows language switches', async () => {
    await session.send('What tasks are overdue?', { intent: 'overdueTasks' });
    const fixture = TestBed.createComponent(SurfaceSlot);
    fixture.componentRef.setInput('surfaceIds', [lastSurfaceId()]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const overdue = dataOf(lastSurfaceId(), '/total') as number;
    expect(el.querySelectorAll('[data-testid="a2ui-record"]').length).toBe(overdue);
    expect(el.textContent).toContain(`${overdue} tasks are overdue`);

    await TestBed.inject(LanguageService).use('fr');
    await fixture.whenStable();
    expect(el.textContent).toContain(`${overdue} tâches en retard`);
    // Agent text keeps its translation key, so it re-localizes too.
    const message = store.messages().filter((m) => m.role === 'assistant' && m.text).at(-1)!;
    const language = TestBed.inject(LanguageService);
    expect(renderText(store.i18n()[message.id], { t: (k, p) => language.t(k, p), plural: (k, c, p) => language.plural(k, c, p) })).toContain('tâches en retard');
  });

  it('dispatches surface buttons as A2UI actions that start a new run', async () => {
    await session.send('Show my biggest open deals', { intent: 'topDeals', scope: 'mine' });
    const fixture = TestBed.createComponent(SurfaceSlot);
    fixture.componentRef.setInput('surfaceIds', [lastSurfaceId()]);
    await fixture.whenStable();
    const runs = store.runs().length;
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="a2ui-toggle-scope"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fixture.whenStable();
    expect(store.runs().length).toBe(runs + 1);
    expect(store.runs()[0].trigger).toBe('action dealList.scope');
    expect(dataOf(lastSurfaceId(), '/total')).toBe(TestBed.inject(DealsStore).openDeals().length);
  });

  it('resets the conversation and removes rendered surfaces', async () => {
    await session.send('Show me the sales overview', { intent: 'salesOverview' });
    const id = lastSurfaceId();
    expect(renderer.surfaceGroup.getSurface(id)).toBeDefined();
    session.reset();
    expect(store.messages()).toEqual([]);
    expect(renderer.surfaceGroup.getSurface(id)).toBeUndefined();
  });
});
