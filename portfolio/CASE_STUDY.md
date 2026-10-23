# Orbit CRM — Case Study

![Orbit CRM cover](cover/orbit-crm-cover.png)

## Project overview

Orbit CRM is a modern sales workspace for small and mid-sized sales teams, agencies and the
managers who lead them. It brings the core of a CRM into one interface: an executive dashboard,
a Kanban sales pipeline, deal records, contacts and companies, follow-up tasks, and a reporting
area — in English, Arabic and French.

It was built as a portfolio project to demonstrate production-grade frontend engineering:
component architecture, reactive state management, data visualisation, internationalisation,
accessibility and visual design. It is an interactive frontend demo backed by a seeded local
dataset rather than a deployed multi-user product.

## The challenge

Sales teams juggle relationships across spreadsheets, inboxes and calendars. The questions that
matter — *What's in the pipeline? What did we close this quarter? Which follow-ups are overdue?
Who is on track against quota?* — are hard to answer when data is scattered or when reports are
static snapshots that drift from reality.

For the product to be credible, every number on screen had to be **derived from the same records**
that users edit. Moving a deal to *Won* must update revenue, win rate, monthly charts, team
attainment and the activity feed immediately — without a backend — and the experience had to
work equally well for an Arabic-speaking team reading right-to-left as for an English or French one.

## The solution

Orbit CRM keeps a single, typed, persisted dataset in the browser and treats every view as a
function of it:

- **Entity stores** cache companies, contacts, deals, activities and timeline events.
- **Domain commands** apply business rules once — closing a deal stamps its close date, losing one
  records the stage it was lost at, completing a task updates the contact's last interaction, and
  deleting a company unlinks (rather than deletes) its contacts and deals.
- **Pure analytics functions** turn records into KPIs and chart series, wrapped in computed
  signals so the UI updates the moment data changes.

The result behaves like a real application: edits persist across reloads, resetting restores the
original dataset, and corrupted storage is detected and repaired.

## Key features

- **Dashboard** — Total revenue, pipeline value (with weighted value), active deals, win rate,
  average deal size and open follow-ups, each with a period comparison when the data supports one.
  Revenue performance, pipeline by stage, lead sources, deals won per month, team quota attainment
  and a live activity feed — all filtered by date range and team member.
- **Pipeline** — six-stage Kanban with drag & drop, a "Move to" menu for keyboard and touch users,
  undo, search, owner/priority/stage filters, sort options and a list view.
- **Deal details** — clickable stage stepper, probability and weighted value, notes, linked tasks,
  company and contact cards, and a timeline.
- **Contacts & companies** — directories with search, filters, sorting and pagination; rich
  profiles with deals, tasks and activity; validated forms with duplicate detection.
- **Tasks & activities** — overdue / today / next 7 days / later grouping, one-click completion
  with undo, a weekly summary and a recently completed feed.
- **Reports** — revenue trend, cohort conversion funnel, pipeline analysis (total vs. weighted),
  deal-size distribution, salesperson performance and lead-source insights.
- **Settings** — theme (light/dark/system), reduced motion, language, workspace defaults, table
  density, dataset information, JSON export and demo reset.

## Engineering approach

**Angular architecture.** Standalone components with OnPush change detection in a zoneless
application, feature-oriented folders, and lazy-loaded routes. Create/edit dialogs and the command
palette load on demand.

**Signal Stores.** Root entity stores are composed from a reusable NgRx SignalStore feature that
adds load state and optimistic create/update/delete with rollback. Feature view stores hold
filters, sorting and paging at root level so they survive navigation and language changes; all
derived values are computed.

**Data modelling.** Typed entities with stable enum values; translations never touch stored data.
Relationships are nullable where deletion can unlink them, and a validator repairs dangling
references, drops invalid records and handles outdated schema versions.

**Mock repositories.** UI code depends only on repository contracts (abstract classes used as
dependency-injection tokens). The demo binds them to a browser-storage implementation; an HTTP
implementation could be provided instead without changing components or stores.

**Chart derivation.** ECharts option builders receive data from computed store selectors and read
colours from the live CSS theme at render time, so charts react to data, theme and language
changes. Revenue comparisons are aligned bucket-by-bucket, and comparisons are suppressed when the
previous period isn't fully covered by recorded history.

**Deterministic seed.** A fixed-seed generator produces 8 team members, 30 fictional companies,
100 contacts, 80 deals, 120 activities and the timeline events that follow from them, anchored to
the day the workspace is first opened so the demo always looks current.

## Design decisions

- **Restrained, original visual language** — slate neutrals, an indigo accent, emerald/amber/red
  for status only, an 8 px spacing rhythm, subtle borders and shadows, and Inter with tabular
  figures for numbers.
- **Semantic tokens for both themes** — every colour is a CSS variable mapped into Tailwind, so
  dark mode is designed, not inverted.
- **Validated chart palette** — the categorical colours were checked for colour-vision-deficiency
  separation and contrast in light and dark modes; pipeline stages use an ordinal indigo ramp with
  status colours reserved for Won and Lost.
- **Native controls first** — buttons, selects and inputs keep their built-in semantics; CDK
  supplies menus, dialogs, overlays and drag & drop.
- **Honest numbers** — when a comparison can't be computed from real data, the interface says so
  instead of inventing a trend.
- **States everywhere** — skeletons that match final layouts, purposeful empty states, toasts with
  undo, and a clear "Demo workspace" label so visitors know what they are exploring.

## Internationalization & RTL Engineering

![Arabic RTL dashboard](screenshots/11-dashboard-arabic-rtl.png)

**Why ngx-translate.** The product needed runtime language switching without rebuilding or
reloading, JSON dictionaries organised by feature that are easy to review, and a reactive API that
fits signals and OnPush components. Angular's compile-time i18n produces one build per locale,
which doesn't support instant switching while preserving application state.

**Runtime switching.** A `LanguageService` coordinates everything: it loads the target dictionary
first, then switches ngx-translate, updates `<html lang dir>`, notifies the CDK `Directionality`
(used by overlays and drag & drop) and persists the choice — in one step, so raw keys never flash.
It exposes signals (`code`, `locale`, `isRtl`) and reactive `t()` / `plural()` helpers used by
charts, toasts and page titles. Filters, open dialogs' underlying data and records are untouched.

**Persistence.** The language is saved under its own `localStorage` key, restored before the app
boots (an inline script sets `lang`/`dir` to avoid a flash), falls back to English for unsupported
values, and survives a demo-data reset.

**RTL layout.** Layout is written with CSS logical properties (`ps-*`, `me-*`, `start-*`,
`text-start`, `border-e`), so the sidebar, drawers, toasts, tables, pagination, stepper and
Kanban board mirror naturally. Direction-dependent icons (chevrons, back arrows, trends) flip;
emails, phone numbers and URLs render as isolated LTR islands; Arabic uses IBM Plex Sans Arabic
with letter-spacing disabled to protect letter joining. Plural rules use `Intl.PluralRules` with
all six Arabic CLDR categories.

**Translated charts.** Chart labels, legends, tooltips and empty states are produced inside
computed signals that read the active language, so ECharts re-renders on switch. In RTL, time
axes run right-to-left and value axes move to the right; charts render inside an LTR box so SVG
text anchors stay correct.

**Locale-aware formatting.** Dates, numbers, percentages, relative times, country names and
currency use `Intl` (Arabic pinned to the Gregorian calendar and Latin digits). Amounts always
stay in USD — switching language never converts values — and the Latin currency symbol is
wrapped in Unicode isolates so `US$` isn't reordered by the bidirectional algorithm.

**Testing multilingual behaviour.** A script and a unit test enforce identical keys across all
three dictionaries, complete plural categories and matching placeholders, and verify every key
used in code exists. Unit tests cover default language, RTL switching, persistence, fallback and
plural selection. E2E tests switch EN → AR → FR while checking direction, sidebar position,
preserved filters, translated chart text, dialogs, validation and toasts, the absence of English
strings in Arabic and French views, RTL drag & drop, unchanged monetary values and mobile layouts.

## Technical highlights

- Reactive end-to-end: dragging a deal to *Won* updates revenue, win rate, charts, quota
  attainment and the feed instantly, with undo.
- Reusable optimistic-CRUD SignalStore feature with rollback.
- Repository contracts that isolate the UI from persistence.
- Versioned persistence with validation, repair and recovery.
- Cohort-based conversion funnel using the stage at which lost deals were lost.
- Full RTL support with mirrored charts and bidi-safe formatting.
- Keyboard-accessible alternatives for drag & drop, roving-tabindex tabs that follow reading
  direction, focus management and reduced-motion support.
- Initial bundle of 574 kB raw (~155 kB transferred), with ECharts in a lazy chunk.

## Testing and quality

- TypeScript strict mode and angular-eslint (including template accessibility rules) pass.
- 71 unit tests (Vitest) cover metric definitions, comparability rules, domain rules, the seed,
  persistence/reset/recovery, CRUD and cascades, the language service, dictionary parity,
  formatting and form validation in three languages.
- 22 Playwright E2E tests run against the production build on desktop and mobile viewports — both
  locally and against the live Vercel deployment; each fails on any browser console error.
- The interface was reviewed visually at 1440, 768 and 390 px widths in English, Arabic and French
  and in dark mode; overflow, clipping and RTL issues found during review were fixed.

## Screenshots

| Desktop | |
| --- | --- |
| ![Dashboard](screenshots/01-dashboard-desktop.png) | ![Pipeline](screenshots/02-sales-pipeline.png) |
| ![Deal details](screenshots/03-deal-details.png) | ![Contacts](screenshots/04-contacts-management.png) |
| ![Contact profile](screenshots/05-contact-details.png) | ![Companies](screenshots/06-companies.png) |
| ![Reports](screenshots/07-reports-analytics.png) | ![Dark mode](screenshots/10-dark-mode.png) |
| ![Arabic pipeline](screenshots/12-pipeline-arabic-rtl.png) | ![Arabic contacts](screenshots/13-contacts-arabic-rtl.png) |
| ![French dashboard](screenshots/14-dashboard-french.png) | |

Mobile: [dashboard](screenshots/08-mobile-dashboard.png) ·
[pipeline](screenshots/09-mobile-pipeline.png) · [Arabic RTL](screenshots/15-mobile-arabic-rtl.png)

## Demo

- **Live demo** — [orbit-crm-demo.vercel.app](https://orbit-crm-demo.vercel.app) (deployed on
  Vercel from the GitHub repository; the full E2E suite passes against it).
- **Product walkthrough** — [`videos/orbit-crm-walkthrough.mp4`](videos/orbit-crm-walkthrough.mp4)
  (1920×1080, 30 fps, 72 s): dashboard and analytics, reports, dragging a deal to *Won* and seeing
  the dashboard update, contacts, task completion, English → Arabic → French, mobile layout and
  dark mode. Poster: [`cover/orbit-crm-video-poster.png`](cover/orbit-crm-video-poster.png).
- **Social short** — [`videos/orbit-crm-short.mp4`](videos/orbit-crm-short.mp4) (1080×1920,
  30 fps, 26 s): mobile dashboard, moving a deal, switching to Arabic RTL and dark mode.

Both videos were recorded from the running production build with scripted browser automation;
captions and the pointer are overlays drawn outside the application.

## Limitations

Orbit CRM is a frontend-only interactive demonstration using local seeded data. It is deployed as
a static site, but it is not a multi-user production CRM: there is no backend, authentication, permissions, real-time
collaboration or server-side validation, and data is stored in a single browser's `localStorage`.
All companies, people and figures are fictional, and no performance numbers, customer outcomes or
business results are claimed.
