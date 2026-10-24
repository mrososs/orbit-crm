# Interactive Demo Assistant — AG-UI + A2UI

Orbit CRM includes an **Interactive Demo Assistant**. You ask for a view ("show my biggest open
deals", "create a follow-up task") and it answers with interactive UI built from live CRM data:
KPI cards, a chart, record lists, a validated form, a confirmation step with *Undo*.

It is a **scripted demo**: there is no language model, AI API, backend or API key, and the
interface says so ("Scripted demo · no AI model · runs in your browser"). What it shows is the
*plumbing* a real agentic UI needs. An agent streams standard protocol events, the UI it sends
is declarative JSON validated at the boundary, and every write goes through allowlisted domain
commands.

- Code: `src/app/features/assistant/`
- Open it from the **Assistant** button in the top bar, or from the command palette (Ctrl/⌘ K).

---

## Contents

1. [Two protocols, two jobs](#1-two-protocols-two-jobs)
2. [Why no LLM](#2-why-no-llm)
3. [Architecture](#3-architecture)
4. [Event flow of one request](#4-event-flow-of-one-request)
5. [Deterministic routing](#5-deterministic-routing)
6. [Zod at every boundary](#6-zod-at-every-boundary)
7. [Rendering A2UI with Angular](#7-rendering-a2ui-with-angular)
8. [Safe actions](#8-safe-actions)
9. [Simulated network latency](#9-simulated-network-latency)
10. [Protocol examples](#10-protocol-examples)
11. [Swapping in a remote agent](#11-swapping-in-a-remote-agent)
12. [Tests](#12-tests)
13. [Limitations](#13-limitations)

---

## 1. Two protocols, two jobs

| | **AG-UI** (Agent–User Interaction) | **A2UI** (Agent-to-UI) |
| --- | --- | --- |
| Answers | *How does an agent talk to a frontend?* | *What UI should the frontend show?* |
| Shape | A stream of typed events: `RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_*`, `ACTIVITY_*`, `RUN_FINISHED`… | Declarative JSON messages: `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface` |
| Packages used | `@ag-ui/core` 1.0.3 (types, event schemas), `@ag-ui/client` 1.0.3 (`AbstractAgent` runtime) | `@a2ui/web_core` 0.14 (message processor), `@a2ui/angular` 0.13 (renderer) — protocol **v0.9.1** |
| In Orbit | The transport between chat UI and agent; shown live in the **AG-UI events** tab | The interactive cards inside the conversation, rendered with Orbit's own component catalog |

**How they fit together.** A2UI messages travel *inside* AG-UI activity events. An
`ACTIVITY_SNAPSHOT` with `activityType: "a2ui-surface"` carries `content.a2ui_operations`, and later
updates arrive as `ACTIVITY_DELTA` JSON patches that append operations. When someone clicks a
button in a surface, the resulting A2UI action goes back to the agent as a new run, in
`forwardedProps.a2uiAction.userAction`. This follows the convention used by existing AG-UI ↔ A2UI
integrations. Neither specification standardises it yet (see [Limitations](#13-limitations)).

## 2. Why no LLM

This is a public portfolio demo, so it must be free to run, private and predictable:

- **No keys, no cost, no data leaving the browser.** The CRM data lives in `localStorage`, and so
  does the agent.
- **Deterministic.** The same request always produces the same UI, so E2E tests can assert exact
  behaviour and screenshots and videos can be regenerated.
- **Honest.** A model would invite questions the demo can't answer. Instead, the assistant
  recognises a fixed catalogue of requests in English, Arabic and French. For anything else it says
  so and lists what it can do. It never guesses.
- **The protocols are the point.** The agent extends the official `AbstractAgent`. Replacing it
  with a remote agent, which could be LLM-backed, changes one class (see
  [§11](#11-swapping-in-a-remote-agent)).

## 3. Architecture

```
┌──────────────────────── Angular (lazy chunk, loaded on first open) ────────────────────────┐
│                                                                                             │
│  AssistantPanel ── Conversation / Composer / EventInspector      (signals, OnPush)          │
│        │  ▲                                                                                 │
│        │  │ AssistantStore (NgRx SignalStore: messages, runs, events, notices)              │
│        ▼  │                                                                                 │
│  AssistantSession ── @ag-ui/client runAgent() + subscriber ─────────────┐                   │
│        │        ▲                                                      │ AG-UI events       │
│        │        │ ACTIVITY_* → Zod (A2uiActivityContent / Patch) ──► A2uiRendererService     │
│        │        │                                                      │   + Orbit catalog   │
│        ▼        │                                                      │   (Angular comps)   │
│  OrbitDemoAgent extends AbstractAgent ◄── forwardedProps (Zod) ◄── AssistantActionDispatcher│
│        │                                                    (Zod allowlist of user actions) │
│        ▼                                                                                    │
│  IntentMatcher (intents.json)  →  DemoWorkflows  →  scenario fixtures (JSON, Zod-validated) │
│                                        │                                                    │
│                                        ▼                                                    │
│                         AssistantTools (allowlisted CRM commands)                           │
└────────────────────────────────────────┼────────────────────────────────────────────────────┘
                                         ▼
                CrmService · entity stores · computeKpis / pipelineByStage   (the real app)
```

| Folder | Responsibility |
| --- | --- |
| `protocol/` | `OrbitDemoAgent` (AG-UI agent), `RunEmitter` (well-formed event sequences, pacing), A2UI-over-AG-UI transport helpers, translatable agent text |
| `engine/` | `intents.json`, `IntentMatcher`, `DemoWorkflows` (one workflow per intent and per user action) |
| `scenarios/` | One JSON fixture per surface: the A2UI component tree, bound to a data model |
| `schemas/` | Zod schemas: A2UI catalog and messages, user actions, commands, fixtures, domain input |
| `services/` | `AssistantSession` (client runtime + rendering), `AssistantActionDispatcher`, `AssistantTools` (CRM adapter) |
| `renderer/` | Orbit A2UI catalog: 16 Angular components and 6 functions |
| `components/`, `state/` | Chat UI, event inspector, SignalStore |

**Loading.** The panel, AG-UI, A2UI and Zod are fetched with a dynamic `import()` the first time
the assistant opens. They form one lazy chunk (≈ 843 kB raw / ≈ 167 kB transferred). The initial
bundle went from ≈ 574 kB / 155 kB to ≈ 591 kB / 160 kB, which covers the form controls, icons
and launcher. The panel stays mounted once loaded, so the conversation survives closing it.

**Layout.** At 1440 px and wider, the panel docks beside the page (`role="region"`, non-modal), so
CRM screens can be watched updating. Page layouts use page-width container breakpoints
(`page-xl:`, `page-2xl:`), so they reflow for the narrower column. Below 1440 px it is a modal
drawer, full-screen on phones (`role="dialog"`, focus trap, Escape, focus restored to the
toggle).

## 4. Event flow of one request

What happens when a visitor types **"top 2 deals"**. The sequence is real, captured from the
production build's event inspector:

```
client                                   OrbitDemoAgent (in the browser)
──────                                   ───────────────────────────────
addMessage(user) → runAgent({runId})
                        ··· simulated connection: 450–950 ms ···
                                         RUN_STARTED
                                         STATE_SNAPSHOT        agent memory (lastIntent, surfaces)
                                         CUSTOM orbit.intent   {intent:"topDeals", score:60,
                                                                reason:'keywords "deal" + "top"'}
                                         STATE_DELTA           replace /lastIntent
                                         TEXT_MESSAGE_START    metadata: i18n key
                                         TEXT_MESSAGE_CONTENT ×9   "These " "are " …
                                         TEXT_MESSAGE_END
                                         STEP_STARTED query_crm
                                         TOOL_CALL_START crm.listOpenDeals
                                         TOOL_CALL_ARGS ×2     {"scope":"team","limit":2,…}
                                         TOOL_CALL_END
                        ··· simulated tool latency: 350–800 ms ···
                                         TOOL_CALL_RESULT      {"total":32,"returned":2}
                                         STEP_FINISHED
                                         STEP_STARTED render_surface
                                         ACTIVITY_SNAPSHOT     a2ui-surface: createSurface,
                                                               updateComponents, updateDataModel
Zod: A2uiActivityContentSchema ✓
renderer.processMessages(...) → <app-a2ui-*> components
                                         STATE_DELTA           add /surfaces/top-deals-1
                                         STEP_FINISHED
                                         TEXT_MESSAGE_START … END   follow-up hint
                                         RUN_FINISHED          outcome: success
```

- `@ag-ui/client` verifies the sequence and applies messages and state. `AssistantSession` maps the
  subscriber callbacks to the store (chat, streaming, steps, inspector log) and to the renderer.
- Each event is also checked against the official `EventSchemas` from `@ag-ui/core`. Invalid
  events are flagged in the inspector.
- Runs are queued, so an action clicked mid-run waits its turn. **Stop** aborts the run, which
  ends with `RUN_FINISHED` and `outcome: cancelled`. Workflow failures end with `RUN_ERROR`
  (`INVALID_INPUT`, `INVALID_FIXTURE`, `WORKFLOW_ERROR`).
- Agent text carries its translation key in `metadata["orbit.i18n"]`. The chat re-renders past
  messages when the language changes, and so do surfaces, because their labels are `t(...)` calls.

## 5. Deterministic routing

`engine/intents.json` lists eight intents: `salesOverview`, `topDeals`, `overdueTasks`,
`createFollowUp`, `dealsFilter`, `moveDealStage`, `help` and `malformedDemo`. Each has phrases in
EN/FR/AR, keyword groups and a priority. `IntentMatcher`:

1. **Normalises** the text: lower-case, Latin accents stripped, Arabic diacritics and tatweel
   removed, alef/yaa/taa-marbuta variants unified, Arabic-Indic digits converted, punctuation
   collapsed.
2. **Phrase match.** An exact or contained catalogue phrase in any language wins.
3. **Keyword match.** Otherwise every keyword group of an intent must match at least one keyword
   ("deal" + "top"). Ties go to the higher priority.
4. **Parameters.** It extracts a limit ("top 3"), the scope ("my deals" → `mine`), an owner (a team
   member's first name) and a stage (`STAGE_SYNONYMS` in three languages).
5. **No match** returns `null`. The agent then answers honestly that it didn't recognise the
   request and shows the supported options as buttons.

Suggestion chips skip text matching: they send a structured command in
`forwardedProps.command`, validated with `DemoCommandSchema`. The match reason is emitted as a
`CUSTOM` event (`orbit.intent`), so the inspector shows *why* a request was routed.

## 6. Zod at every boundary

Every value crossing a trust boundary is parsed, never trusted:

| Boundary | Schema | On failure |
| --- | --- | --- |
| Intent catalogue (`intents.json`) | `IntentCatalogSchema` | Logged; every request gets the fallback answer |
| Scenario fixtures (`scenarios/*.json`) | `SurfaceFixtureSchema`: component union, unique ids, every child reference exists, a `root` | `FixtureError` → `RUN_ERROR INVALID_FIXTURE` |
| Run input (`forwardedProps`) | `ForwardedPropsSchema` → `DemoCommandSchema` or `AssistantActionSchema` | `RUN_ERROR INVALID_INPUT` |
| A2UI from the agent (`ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA`) | `A2uiActivityContentSchema` / `A2uiActivityPatchSchema`: protocol `v0.9.1` only, Orbit catalog id only, 16 allowlisted component types with strict props, ≤ 60 components, ≤ 40 operations, data model ≤ 100 kB, JSON-pointer paths | Surface **blocked**, with a "Response blocked" card listing the issues; the renderer never sees it |
| A2UI user actions (`actionHandler`) | `AssistantActionSchema`: discriminated union on `name`, strict context per action | Notice "Action blocked"; it never reaches the agent |
| Domain input (follow-up form, stage move) | `followUpInputSchema(lookup)`, `moveRequestSchema(lookup)`: lengths, dates, record existence | Field errors rendered back into the form |

Why validate A2UI on the client even though our own agent produced it? Because the renderer is
built to accept a remote agent. The A2UI processor ignores unknown component types silently, and
that is not a security model. The allowlist is. Ask the assistant to
*"simulate a malformed payload"* to see a deliberately invalid surface get blocked. Zod's issues
are flattened into readable messages (`schemas/zod-issues.ts`).

## 7. Rendering A2UI with Angular

- **Catalog.** `createOrbitCatalog()` builds an `AngularCatalog` (id
  `https://orbit-crm-demo.vercel.app/a2ui/catalogs/orbit/v1.json`) with 16 components. Layout:
  Column, Row, Grid, Card. Content: Text, Notice, Metric, Link, Button. Data: RecordList, Chart.
  Forms: Form, TextField, SelectField, DateField, Confirmation. Each is a standalone OnPush Angular
  component extending A2UI's `CatalogComponent`.
- **Same design system.** The form fields reuse the Orbit form controls (text input, searchable
  combobox, custom dropdown, date picker), and charts reuse the app's ECharts container. A surface
  looks like the rest of the CRM and follows the theme and the text direction.
- **Functions.** `t`, `plural`, `formatCurrency`, `formatNumber`, `formatPercent` and `formatDate`
  are A2UI function implementations that return Angular `computed`s, so a surface re-localises
  instantly when the language changes, with no new run.
- **Data binding.** Components bind to the surface data model with JSON pointers
  (`{"path": "/items"}`). Workflows update a surface by appending `updateDataModel` operations in
  an `ACTIVITY_DELTA`, so a list refreshes in place when its filter changes.
- **Actions.** Buttons and forms resolve their `action.event.context` through the A2UI
  `DataContext`. The renderer's `actionHandler` hands the result to `AssistantActionDispatcher`.

## 8. Safe actions

The assistant can change CRM data, so writes are fenced in:

- **Allowlist.** The agent can only call the commands that `AssistantTools` exposes. Reads:
  `crm.getSalesOverview`, `crm.listOpenDeals`, `crm.listOverdueActivities`, `crm.filterDeals`,
  `crm.getFollowUpOptions`. Writes: `crm.createActivity`, `crm.moveDeal`, `crm.undoMove`. These wrap the same `CrmService` methods
  the UI uses, so timeline events, toasts and KPIs update exactly as if you had clicked in the app.
- **Ten user actions, no more.** `prompt.run`, `dealList.scope`, `dealList.filter`,
  `followUp.submit`, `followUp.cancel`, `deal.startMove`, `deal.reviewMove`, `deal.confirmMove`,
  `deal.cancelMove` and `deal.undoMove`. Anything else is rejected by the dispatcher.
- **Confirmation for state changes.** Moving a deal is a three-step flow: pick → review →
  *Confirm*. The agent remembers the pending move. A `deal.confirmMove` whose deal or stage does
  not match the reviewed one is refused, so a forged or replayed confirmation cannot move a
  different deal.
- **Undo.** Stage moves return a receipt (`rc_…`). *Undo* restores the previous stage, then
  disables itself.
- **Validation before writing.** The follow-up form is validated by Zod against real records
  (subject 3–120 characters, a valid date, a contact *or* a deal that exists) before
  `CrmService.createActivity()` runs.
- **No deletes.** The assistant offers no destructive commands.

## 9. Simulated network latency

Because everything runs locally, responses would otherwise be instant and unlike a real agent.
The `Pacing` settings in `protocol/run-emitter.ts` add:

| | Range | Where |
| --- | --- | --- |
| Connection (`connect`) | 450–950 ms, random jitter | Before `RUN_STARTED`; the chat shows "Connecting to the demo agent…" |
| Each tool call (`tool`) | 350–800 ms, random jitter | Between `TOOL_CALL_END` and `TOOL_CALL_RESULT`; the chat shows the current step |
| Text streaming (`text`) | 28 ms per fragment | Typing effect |

With reduced motion (the OS setting or the in-app toggle), the typing effect is removed but the
network simulation stays, because latency is not an animation. Unit tests use `INSTANT_PACING`.
Stopping a run during the simulated connection still ends it cleanly as `cancelled`. The
inspector explains that the delays are simulated.

## 10. Protocol examples

The events below were captured from the production build's event inspector, with long arrays
trimmed to `…`. The run input is not an event, so it is shown as the session sends it, filled
with the values from the same session.

**Intent routing (`CUSTOM`)**

```json
{ "type": "CUSTOM", "name": "orbit.intent",
  "value": { "intent": "topDeals", "score": 60, "reason": "keywords \"deal\" + \"top\"" } }
```

**Tool call (`TOOL_CALL_*`)**

```json
{ "type": "TOOL_CALL_START", "toolCallId": "tool_mvlvva9w2", "toolCallName": "crm.listOpenDeals" }
{ "type": "TOOL_CALL_ARGS",  "toolCallId": "tool_mvlvva9w2", "delta": "{\"scope\":\"team\",\"limit\":2,\"sort\"" }
{ "type": "TOOL_CALL_ARGS",  "toolCallId": "tool_mvlvva9w2", "delta": ":\"value_desc\"}" }
{ "type": "TOOL_CALL_END",   "toolCallId": "tool_mvlvva9w2" }
{ "type": "TOOL_CALL_RESULT", "toolCallId": "tool_mvlvva9w2", "role": "tool",
  "messageId": "toolmsg_mvlvvapg3", "content": "{\"total\":32,\"returned\":2}" }
```

**A surface (`ACTIVITY_SNAPSHOT` carrying A2UI v0.9.1)**

```json
{
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "surface_mvlvvapi4",
  "activityType": "a2ui-surface",
  "content": {
    "a2ui_operations": [
      { "version": "v0.9.1",
        "createSurface": { "surfaceId": "top-deals-1",
                           "catalogId": "https://orbit-crm-demo.vercel.app/a2ui/catalogs/orbit/v1.json" } },
      { "version": "v0.9.1",
        "updateComponents": { "surfaceId": "top-deals-1", "components": [
          { "id": "root", "component": "Column", "children": ["summary", "list", "footer"] },
          { "id": "value", "component": "Metric", "format": "currency", "icon": "circle-dollar-sign",
            "label": { "call": "t", "args": { "key": "kpi.pipelineValue" } },
            "value": { "path": "/totalValue" } },
          { "id": "list", "component": "RecordList", "testId": "a2ui-deal-list",
            "items": { "path": "/items" },
            "itemAction": { "name": "deal.startMove",
                            "label": { "call": "t", "args": { "key": "assistant.deals.moveStage" } } } },
          { "id": "toggle-scope", "component": "Button", "variant": "secondary",
            "label": { "call": "t", "args": { "key": { "path": "/toggleKey" } } },
            "action": { "event": { "name": "dealList.scope",
                                   "context": { "scope": { "path": "/otherScope" } } } } },
          "…"
        ] } },
      { "version": "v0.9.1",
        "updateDataModel": { "surfaceId": "top-deals-1", "value": {
          "countKey": "assistant.deals.countTeam", "toggleKey": "assistant.deals.showMine",
          "otherScope": "mine", "total": 32, "totalValue": 2120000,
          "items": [
            { "id": "dl_071", "title": "Ironbridge Pilot Program", "subtitle": "Ironbridge Industrial",
              "amount": 128500, "date": "2026-11-03", "dateKind": "close", "overdue": false,
              "stage": "proposal", "owner": "Sofia Martinez",
              "link": { "kind": "deal", "id": "dl_071", "label": "Ironbridge Pilot Program" },
              "related": [ { "kind": "company", "id": "co_016", "label": "Ironbridge Industrial" } ] },
            "…"
          ] } } }
    ]
  }
}
```

**A user action becomes a new run (`RunAgentInput.forwardedProps`)**

```json
{
  "threadId": "thread_341f2f4e10e7",
  "runId": "run_…",
  "forwardedProps": {
    "a2uiAction": {
      "userAction": {
        "name": "followUp.submit",
        "surfaceId": "follow-up-form-2",
        "sourceComponentId": "form",
        "timestamp": "2026-10-24T04:13:03.540Z",
        "context": { "subject": "Send the Q3 renewal pricing", "dueDate": "2026-10-25",
                     "dueTime": "10:00", "priority": "medium", "ownerId": "tm_alex",
                     "contactId": "ct_069", "dealId": "" }
      }
    }
  }
}
```

**Updating an existing surface in place (`ACTIVITY_DELTA`)**

```json
{
  "type": "ACTIVITY_DELTA",
  "messageId": "surface_mvlvvcg49",
  "activityType": "a2ui-surface",
  "patch": [
    { "op": "add", "path": "/a2ui_operations/-",
      "value": { "version": "v0.9.1",
                 "updateDataModel": { "surfaceId": "follow-up-form-2", "path": "/status", "value": "submitted" } } }
  ]
}
```

**State (`STATE_DELTA`) and the end of a run**

```json
{ "type": "STATE_DELTA", "delta": [ { "op": "add", "path": "/surfaces/top-deals-1", "value": "top-deals" } ] }
{ "type": "RUN_FINISHED", "threadId": "thread_341f2f4e10e7", "runId": "run_906eb2297229",
  "result": { "handled": "topDeals" }, "outcome": { "type": "success" } }
```

## 11. Swapping in a remote agent

`OrbitDemoAgent` is the only local piece. `AssistantSession` creates it and drives it through the
standard `runAgent()` API, so a remote agent drops in at the same place:

```ts
import { HttpAgent } from '@ag-ui/client';

// services/assistant-session.ts
private readonly agent = new HttpAgent({
  url: '/api/agent',            // any AG-UI endpoint (SSE or the binary encoder)
  threadId: createId('thread'),
});
```

What stays the same: the chat UI, the store, the event inspector, the Zod allowlist on every
`ACTIVITY_*` payload, the Orbit A2UI catalog and the action dispatcher. The server would:

1. Accept `RunAgentInput` and stream AG-UI events.
2. Send surfaces as `ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA` with `activityType: "a2ui-surface"`
   that target the Orbit catalog id. Anything else is blocked by the client.
3. Read clicked actions from `forwardedProps.a2uiAction.userAction`, and re-validate them
   server-side with the same schemas (`schemas/` is framework-free TypeScript).
4. Execute writes through an API equivalent to `AssistantTools`. The confirmation and undo rules
   belong on the server too.

If that agent used a language model, the "no AI model" labelling, the fallback copy and this
document must change with it.

## 12. Tests

- **Unit (Vitest, `assistant.spec.ts`, 40 tests).**
  - Schemas: fixtures, intents, payload limits, actions, domain input.
  - Routing in three languages, with normalisation and parameter extraction.
  - The agent: event order, schema validity, KPI parity with the dashboard, cancellation
    (mid-stream and during the simulated connection), latency, `RUN_ERROR`, the honest fallback,
    and snapshots that later runs do not change.
  - The session: follow-up creation through `CrmService`, move/confirm/undo and forged
    confirmations, in-place filter refresh, blocked actions, malformed payloads, rendering with
    re-localisation, surface buttons, reset.
- **E2E (Playwright, production build).**
  - Desktop: the sales overview matches dashboard KPIs, and the inspector shows schema-valid
    events. Deal lists reflect pipeline changes. Overdue tasks link to records. The follow-up
    form validates, the dropdown stays anchored while the conversation scrolls, and the task
    appears on the Tasks page. A deal moves with confirmation and Undo. The fallback is honest,
    a malformed payload is blocked, and the Arabic RTL panel works.
  - Mobile: a full-screen accessible dialog with Escape and focus restore, and it closes after
    following a record link.
  - Every E2E test fails on any console error.

## 13. Limitations

- **Scripted, not intelligent.** The assistant only understands the catalogue in
  `intents.json`, plus simple parameters. That is intentional, and the UI says so.
- **Transport convention.** AG-UI defines activity events and A2UI defines the UI messages, but
  carrying A2UI in `ACTIVITY_SNAPSHOT` (`a2ui-surface`, `a2ui_operations`) and actions in
  `forwardedProps.a2uiAction` is an integration convention, not part of either spec. A2UI is
  pre-1.0 (v0.9.1), and `@a2ui/angular` is 0.x. Expect changes.
- **Bundle size.** The assistant chunk is ≈ 843 kB raw / ≈ 167 kB transferred, and Zod accounts
  for roughly a third of it. `@ag-ui/client` uses the `zod/v4` entry while the A2UI packages use
  Zod 3, and both ship from the same `zod@3.25.x` package. It only loads when the assistant is
  opened.
- **Dependency advisory.** `npm audit` reports GHSA-mrhx-c7xc-m3w5: Zod < 4.6.6 can exhaust
  memory while validating oversized constrained collections. No fix is available, because
  `@a2ui/*` requires Zod `^3.25.76` and the advisory flags every 3.x release. Here, all validated
  payloads come from the in-browser agent, and sizes are capped before deep validation (data
  model ≤ 100 kB, ≤ 60 components, ≤ 40 operations). Re-assess before accepting payloads from a
  remote agent.
- **Transitive packages.** `@ag-ui/client` depends on `@ag-ui/encoder` / `@ag-ui/proto` (binary
  transport), which the local agent does not use.
- **`rxjs` override.** `package.json` overrides `@ag-ui/client`'s `rxjs` with the app's version,
  so there is one copy. The CommonJS `validate-color` package (pulled in by `@a2ui/web_core`) is
  listed in `allowedCommonJsDependencies`.
- **Angular 21.2.** CopilotKit's Angular SDK requires Angular 22, which needs Node ≥ 24.15. That
  is why the agent runtime is built directly on `@ag-ui/client`, and the renderer on
  `@a2ui/angular`.
