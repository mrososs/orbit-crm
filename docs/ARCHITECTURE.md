# Orbit CRM — Architecture

Orbit CRM is a frontend-only Angular application. Everything a visitor sees is derived from one
seeded, persisted dataset, and the data layer is shaped so a REST backend can replace the mock
implementation without touching UI code.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Angular 21.2 (standalone, zoneless, OnPush) | Angular 22 requires Node ≥ 24.15; the build machine runs 24.11, so 21.2 is the latest release compatible with the environment. Upgrading is a `ng update` away once Node is updated. |
| State | Angular Signals + NgRx SignalStore 21 | Root entity stores + feature view stores |
| Styling | Tailwind CSS 4 (CSS-first `@theme`) | Semantic design tokens as CSS variables; light/dark |
| Overlays, menus, drag & drop | Angular CDK 21 | Dialog, Menu, Overlay, DragDrop, A11y, Bidi |
| Charts | Apache ECharts 6 (tree-shaken, SVG renderer) | Lazy chunk shared by dashboard and reports |
| i18n | ngx-translate 18 + `Intl` | EN / AR (RTL) / FR, runtime switching |
| Forms | Angular Signal Forms + Orbit custom controls | `FormValueControl` / `FormCheckboxControl` components in `shared/ui/controls` |
| Agentic UI | AG-UI 1.0.3 (`@ag-ui/core`, `@ag-ui/client`), A2UI v0.9.1 (`@a2ui/web_core` 0.14, `@a2ui/angular` 0.13), Zod 3.25 | Deterministic in-browser agent; one lazy chunk — see [AGENTIC_DEMO.md](./AGENTIC_DEMO.md) |
| Icons | Lucide (`@lucide/angular` dynamic icon + `lucide` icon data) | One component, 92 registered icons |
| Tests | Vitest (Angular unit-test builder) + Playwright | 126 unit tests, 32 E2E tests |

## Folder structure

```
src/app/
  core/
    analytics/      date ranges + pure metric functions (KPIs, series, funnel, team…)
    data/           LocalDatabase (persistence), schema validation, deterministic seed
    domain/         pure business rules (stage changes, task buckets)
    i18n/           LanguageService, language model, Intl formatting, title strategy
    layout/         shell, sidebar, top bar, command palette, quick-create
    models/         typed entities and enumerations
    repositories/   repository contracts + browser-storage implementations
    services/       preferences, theme, toasts, viewport, platform tokens
  shared/
    ui/             design-system components (button, badge, dialog, tabs, chart…)
      controls/     Signal Forms custom controls (inputs, dropdown, combobox, date picker…)
    charts/         ECharts container, theme reader, formatters
    domain/         CRM-aware presentational pieces (badges, timeline, task row, record actions)
    pipes/ directives/ utils/
  state/            root entity stores, CRUD store feature, CrmService, WorkspaceService
  features/         dashboard, pipeline, deals, contacts, companies, activities, reports, settings,
                    showcase (form controls), assistant (AG-UI + A2UI demo assistant)
```

Every feature route is lazy-loaded (`loadComponent`). Entity create/edit dialogs and the command
palette are loaded on demand, so they are not part of the initial bundle. The demo assistant is
imported with a dynamic `import()` and created with `ViewContainerRef.createComponent` the first
time it opens. This replaced `@defer`, because its runtime added ≈ 14 kB to the initial chunk.

## Data flow

```
          ┌────────────── UI (OnPush components, signals) ──────────────┐
          │  feature view stores (filters, sort, paging) ── computed ───┤
          │                │                                              │
          │      RecordActions (confirm → command → toast + undo)        │
          └────────────────┬──────────────────────────────────────────────┘
                           ▼
                  CrmService (domain commands, timeline events, cascades)
                           ▼
        Root entity stores  (NgRx SignalStore + withEntities + withEntityCrud)
                           ▼
        Repository contracts (abstract classes used as DI tokens)
                           ▼
        LocalCollectionRepository  ──►  LocalDatabase  ──►  localStorage
```

### Repositories (`core/repositories`)

`CrudRepository<T>` defines `list / create / update / remove` returning promises.
`DealRepository`, `ContactRepository`, … are abstract classes used as injection tokens, and
`provideLocalRepositories()` binds them to a generic `LocalCollectionRepository` backed by
`LocalDatabase`. To move to a real API, provide HTTP implementations of the same contracts — stores,
services and components do not change.

### Stores (`state/`)

- **Root entity stores** (`TeamStore`, `CompaniesStore`, `ContactsStore`, `DealsStore`,
  `ActivitiesStore`, `TimelineStore`) are the client-side cache shared by all features. They are
  composed from a reusable `withEntityCrud()` SignalStore feature that adds load state and
  **optimistic** add/patch/remove with rollback if persistence fails, plus computed indexes
  (`byCompany`, `byContact`, `byStage`, …).
- **Feature view stores** (`DashboardStore`, `PipelineStore`, `ContactsViewStore`,
  `CompaniesViewStore`, `TasksViewStore`, `ReportsStore`) hold filters, sorting and paging at root
  level, so state survives navigation and language switches. All derived values are `computed`.

### Domain commands (`state/crm.service.ts`)

Anything that touches more than one collection lives in one place: creating a deal logs timeline
events, moving a deal stamps/clears `closedAt` and records `lostAtStage`, completing a task logs an
event and refreshes the contact's `lastInteractionAt`, deleting a company or contact **unlinks**
related records instead of deleting them. Stage moves return a receipt so the UI can offer *Undo*.
The underlying rules are pure functions in `core/domain` and are unit-tested in isolation.

### Analytics (`core/analytics`)

Metrics are pure functions over entity arrays (`computeKpis`, `revenueSeries`, `pipelineByStage`,
`conversionFunnel`, `teamPerformance`, …). Stores wrap them in `computed`, so any write — a drag to
*Won*, a new deal, a completed task — re-derives every dependent KPI and chart. Definitions are in
[METRICS.md](./METRICS.md).

### Persistence (`core/data`)

`LocalDatabase` stores one versioned document (`schemaVersion`) under `orbit-crm.workspace`.
On load it runs `sanitizeDatabase()`:

- unparsable JSON or an outdated schema → the seed is regenerated (visitor is told);
- invalid records are dropped, duplicate ids removed, dangling references unlinked, inconsistent
  close data repaired (visitor is told);
- otherwise the snapshot is restored as-is.

Preferences (`orbit-crm.preferences`) and language (`orbit-crm.language`) are stored separately,
so **Reset demo data** never changes theme, language or layout choices. Storage failures fall back
to in-memory storage.

## Internationalisation & RTL

- `LanguageService` is the single source of truth: it loads the dictionary first and then flips
  `lang`/`dir`, CDK `Directionality`, and persistence in one step (no raw keys are ever rendered).
  It exposes signals (`code`, `locale`, `direction`, `isRtl`) and helpers `t()` and `plural()`
  that are reactive inside `computed`.
- Plurals use `Intl.PluralRules` with CLDR categories in the dictionaries (Arabic has all six:
  zero/one/two/few/many/other).
- Values are formatted with `Intl` (`formatCurrency`, `formatDate`, relative time, region names)
  and never converted: amounts are always in the workspace currency (USD).
- Layout uses CSS logical properties (`ps-`, `me-`, `start-`, `text-start`, `border-e`…);
  direction-dependent icons get `rtl-flip`; emails, phones and URLs are LTR islands.
- Charts mirror explicitly for RTL (inverted time axes, right-hand value axes) and render inside
  an LTR box so SVG text anchors stay correct; Latin currency symbols are wrapped in Unicode
  isolates so `US$` is not reordered to `$US`.
- The page `<title>` follows both navigation and language (`TranslatedTitleStrategy`).
- `scripts/check-i18n.mjs` enforces key parity, plural completeness, placeholder parity and that
  every key used in code exists, including keys referenced from the assistant's JSON scenario
  fixtures.

## UI system

Native elements carry semantics (`button[ui-button]`, `input.control`) and are styled by a small
set of component classes over Tailwind tokens. Reusable components cover the cases native elements
cannot: dialog/drawer frame, confirm dialog, toasts, tabs, tooltip, stat card with animated
count-up, skeletons, empty states, paginator, sort headers, range filter and the ECharts container.

### Form controls (`shared/ui/controls`)

Every form field and list filter uses one family of controls built on the Signal Forms
custom-control API:

- `ControlBase` holds what all of them share. `[formField]` binds `errors`, `disabled`, `readonly`,
  `required`, `invalid`, `pending`, `hidden`, `dirty` and `name`, plus a `touched` model. On top of
  that come the label, hint, *Optional* tag, loading state, generated ids, and the
  `aria-describedby` / `aria-invalid` wiring to a translated error message. `focus()` lets Signal
  Forms focus the first invalid field.
- **Value controls** (`FormValueControl`): text, email, phone, URL, password (with reveal), number
  (`transformedValue` reports parse errors), currency (locale symbol, group/decimal separators,
  Arabic-Indic digits), textarea (character counter), date / time (shortcuts and a localized echo).
- **Boolean controls** (`FormCheckboxControl`): checkbox and switch.
- **Listbox controls**: `ui-select` (custom dropdown) and `ui-combobox` (searchable select) share
  `ListboxControl`. The trigger keeps focus and points at the active option with
  `aria-activedescendant`. Keyboard: arrows, Home/End, Enter/Space, Escape, Tab and type-ahead.
  The popup is a CDK `Overlay` + `TemplatePortal`: the connected-overlay directive would have
  added ≈ 9 kB to the initial bundle. It re-anchors whenever any ancestor scrolls (dialog bodies,
  the assistant conversation), because the CDK reposition strategy only follows registered
  scroll containers.
- Stable `data-testid`s: `{testId}`, `{testId}-panel` and `{testId}-option` with `data-value`.

The controls follow language, direction and theme, and are documented live at `/showcase`.

### Page-width breakpoints

Wide layouts use `page-xl:` / `page-2xl:` instead of Tailwind's `xl:` / `2xl:`. These are
container queries on the shell's content column (`@container/page`). With the sidebar visible they
switch at exactly the same viewport widths, but they also account for the docked assistant panel,
which narrows the column by 25 rem. The chart container takes an *options builder* so colours are read from the
live CSS theme tokens at render time; the categorical palette was validated for colour-vision
deficiency and contrast in both themes.

## Interactive Demo Assistant

`features/assistant` is an AG-UI agent (`OrbitDemoAgent extends AbstractAgent`) running in the
browser. Its replies are A2UI v0.9.1 surfaces carried in AG-UI activity events. Zod validates every
boundary: the intent catalogue, scenario fixtures, run input, A2UI payloads, user actions and
domain input. An Angular A2UI catalog renders the surfaces using the same form controls and chart
container as the app. CRM access goes through `AssistantTools`, an allowlisted adapter over the
root stores and `CrmService`, so the assistant has no side door into state. Stage moves need an
explicit, matching confirmation and can be undone. Full design, event flow and protocol examples:
[AGENTIC_DEMO.md](./AGENTIC_DEMO.md).

## Accessibility

Keyboard-operable menus (CDK Menu), roving-tabindex tabs that follow reading direction, focus-trapped
dialogs and mobile drawer, visible focus rings, `aria-sort` on sortable headers, `aria-invalid` /
`aria-describedby` on form controls, polite live regions for toasts and pagination, a non-drag
"Move to" alternative for every pipeline card, reduced-motion support (system setting or in-app
toggle) and a skip link. Listbox controls follow the ARIA combobox pattern. The assistant is a
modal dialog with a focus trap below 1440 px and a labelled region when docked. Its conversation
is a polite live region, and Escape closes it.

## Performance

- Initial bundle: **≈ 591 kB raw / ≈ 160 kB transferred**, up from 574 kB / 155 kB before the form
  controls and assistant launcher. ECharts is a separate lazy chunk (≈ 185 kB transferred) loaded
  only by chart pages. The assistant (AG-UI, A2UI, Zod, agent and catalog) is a lazy chunk of
  ≈ 843 kB raw / ≈ 167 kB transferred, loaded on first open.
- Lucide icons are registered as plain SVG data rendered by one dynamic component; registering
  icon components instead added ~270 kB of compiled templates.
- Intl formatters are cached; derived data is memoised by `computed`.

## Testing

- **Unit (Vitest):** metric definitions and comparisons, date ranges, stage/task rules, seed
  determinism and referential integrity, persistence restore/repair/recover/reset, CRUD and
  cascades through `CrmService`, language service (default, RTL, persistence, plurals),
  dictionary parity, locale formatting, and contact form validation in three languages.
  Form controls: value binding, touched and error display, readonly guards, currency parsing,
  dropdown mouse/keyboard/type-ahead. The assistant: schemas, routing, AG-UI event order and
  validity, cancellation, latency, and session actions with confirmation and undo (see
  [AGENTIC_DEMO.md § Tests](./AGENTIC_DEMO.md#12-tests)).
- **E2E (Playwright, production build):** dashboard, drag-and-drop to Won updating KPIs, keyboard
  move with undo, filters surviving navigation, contact create/edit with validation, task
  completion, persistence across reload, reset, 404, i18n (RTL/LTR switching, persistence,
  translated charts/dialogs/toasts, no English leakage, RTL drag-and-drop, unchanged amounts) and
  mobile navigation in English, Arabic and French. Also covered: the form-controls showcase,
  seven desktop assistant flows and two mobile assistant flows. Every test fails on console
  errors.
