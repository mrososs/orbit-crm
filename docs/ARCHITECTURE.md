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
| Forms | Angular Signal Forms | Schema validators, translated messages |
| Icons | Lucide (`@lucide/angular` dynamic icon + `lucide` icon data) | One component, 84 registered icons |
| Tests | Vitest (Angular unit-test builder) + Playwright | 71 unit tests, 22 E2E tests |

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
    charts/         ECharts container, theme reader, formatters
    domain/         CRM-aware presentational pieces (badges, timeline, task row, record actions)
    pipes/ directives/ utils/
  state/            root entity stores, CRUD store feature, CrmService, WorkspaceService
  features/         dashboard, pipeline, deals, contacts, companies, activities, reports, settings
```

Every feature route is lazy-loaded (`loadComponent`). Entity create/edit dialogs and the command
palette are loaded on demand, so they are not part of the initial bundle.

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
  every key used in code exists.

## UI system

Native elements carry semantics (`button[ui-button]`, `select.control`, `input.control`) and are
styled by a small set of component classes over Tailwind tokens. Reusable components cover the
cases native elements cannot: dialog/drawer frame, confirm dialog, toasts, tabs, tooltip, stat
card with animated count-up, skeletons, empty states, paginator, sort headers, range filter and
the ECharts container. The chart container takes an *options builder* so colours are read from the
live CSS theme tokens at render time; the categorical palette was validated for colour-vision
deficiency and contrast in both themes.

## Accessibility

Keyboard-operable menus (CDK Menu), roving-tabindex tabs that follow reading direction, focus-trapped
dialogs and mobile drawer, visible focus rings, `aria-sort` on sortable headers, `aria-invalid` /
`aria-describedby` on form controls, polite live regions for toasts and pagination, a non-drag
"Move to" alternative for every pipeline card, reduced-motion support (system setting or in-app
toggle) and a skip link.

## Performance

- Initial bundle: **574 kB raw / ~155 kB transferred**. ECharts is a separate lazy chunk
  (≈185 kB transferred) loaded only by chart pages.
- Lucide icons are registered as plain SVG data rendered by one dynamic component; registering
  icon components instead added ~270 kB of compiled templates.
- Intl formatters are cached; derived data is memoised by `computed`.

## Testing

- **Unit (Vitest):** metric definitions and comparisons, date ranges, stage/task rules, seed
  determinism and referential integrity, persistence restore/repair/recover/reset, CRUD and
  cascades through `CrmService`, language service (default, RTL, persistence, plurals),
  dictionary parity, locale formatting, and contact form validation in three languages.
- **E2E (Playwright, production build):** dashboard, drag-and-drop to Won updating KPIs, keyboard
  move with undo, filters surviving navigation, contact create/edit with validation, task
  completion, persistence across reload, reset, 404, i18n (RTL/LTR switching, persistence,
  translated charts/dialogs/toasts, no English leakage, RTL drag-and-drop, unchanged amounts) and
  mobile navigation in English, Arabic and French. Every test fails on console errors.
