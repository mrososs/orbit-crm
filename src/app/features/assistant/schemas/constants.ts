/**
 * Protocol constants shared by the agent, the renderer and the schemas.
 * Kept free of Angular and Zod so every layer can import them.
 */

/** A2UI message version emitted by the demo agent (the current stable v0.9 family). */
export const A2UI_VERSION = 'v0.9.1';

/**
 * Identifier of the Orbit component catalog. A2UI catalog ids are URIs; this one
 * names the catalog and is never fetched.
 */
export const ORBIT_CATALOG_ID = 'https://orbit-crm-demo.vercel.app/a2ui/catalogs/orbit/v1.json';

/** AG-UI activity type that carries A2UI operations (convention of the AG-UI A2UI middleware). */
export const A2UI_ACTIVITY_TYPE = 'a2ui-surface';

/** Client-side functions the Orbit catalog exposes to A2UI payloads. */
export const ORBIT_FUNCTIONS = ['t', 'plural', 'formatCurrency', 'formatNumber', 'formatPercent', 'formatDate'] as const;
export type OrbitFunctionName = (typeof ORBIT_FUNCTIONS)[number];

/** User actions a surface may dispatch. Anything else is rejected before it reaches the agent. */
export const ASSISTANT_ACTIONS = [
  'prompt.run',
  'dealList.scope',
  'dealList.filter',
  'followUp.submit',
  'followUp.cancel',
  'deal.startMove',
  'deal.reviewMove',
  'deal.confirmMove',
  'deal.cancelMove',
  'deal.undoMove',
] as const;
export type AssistantActionName = (typeof ASSISTANT_ACTIONS)[number];

/** Deterministic scenarios the demo agent understands. */
export const INTENTS = [
  'salesOverview',
  'topDeals',
  'overdueTasks',
  'createFollowUp',
  'dealsFilter',
  'moveDealStage',
  'help',
  'malformedDemo',
] as const;
export type IntentId = (typeof INTENTS)[number];

/** Icons a surface may reference (all registered in `core/icons.ts`). */
export const SURFACE_ICONS = [
  'circle-dollar-sign',
  'layers',
  'trophy',
  'target',
  'list-todo',
  'calendar-clock',
  'calendar-check',
  'briefcase',
  'users',
  'kanban',
  'chart-column',
  'triangle-alert',
  'circle-check',
  'info',
  'arrow-right',
  'arrow-right-left',
  'undo-2',
  'funnel',
  'external-link',
  'layout-dashboard',
] as const;

/** Application pages a surface may link to. */
export const SURFACE_PAGES = ['dashboard', 'pipeline', 'contacts', 'companies', 'activities', 'reports'] as const;

/** Record types a surface may link to; routes are built client-side from the kind and a validated id. */
export const RECORD_KINDS = ['deal', 'contact', 'company'] as const;

/** Translation namespaces the `t`/`plural` functions may read. */
export const TRANSLATION_NAMESPACES = ['assistant', 'enums', 'common', 'kpi', 'validation', 'ranges', 'nav'] as const;
