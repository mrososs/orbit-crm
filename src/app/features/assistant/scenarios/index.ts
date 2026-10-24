import { SurfaceFixture, SurfaceFixtureSchema } from '../schemas/scenario.schemas';
import { formatIssues } from '../schemas/zod-issues';
import capabilities from './capabilities.json';
import dealsFilter from './deals-filter.json';
import followUpForm from './follow-up-form.json';
import followUpSuccess from './follow-up-success.json';
import moveStageConfirm from './move-stage-confirm.json';
import moveStageDone from './move-stage-done.json';
import moveStageForm from './move-stage-form.json';
import overdueTasks from './overdue-tasks.json';
import salesOverview from './sales-overview.json';
import topDeals from './top-deals.json';

/** Scenario surfaces as authored JSON. Validated with Zod on first use. */
export const RAW_FIXTURES = {
  'sales-overview': salesOverview,
  'top-deals': topDeals,
  'overdue-tasks': overdueTasks,
  'follow-up-form': followUpForm,
  'follow-up-success': followUpSuccess,
  'deals-filter': dealsFilter,
  'move-stage-form': moveStageForm,
  'move-stage-confirm': moveStageConfirm,
  'move-stage-done': moveStageDone,
  capabilities,
} as const;

export type FixtureId = keyof typeof RAW_FIXTURES;

export class FixtureError extends Error {
  constructor(
    readonly fixtureId: string,
    readonly issues: string[],
  ) {
    super(`Scenario fixture "${fixtureId}" is invalid: ${issues.join('; ')}`);
  }
}

const cache = new Map<FixtureId, SurfaceFixture>();

/** Returns a validated fixture; an invalid one throws instead of reaching the client. */
export function loadFixture(id: FixtureId): SurfaceFixture {
  const cached = cache.get(id);
  if (cached) return cached;
  const parsed = SurfaceFixtureSchema.safeParse(RAW_FIXTURES[id]);
  if (!parsed.success) {
    throw new FixtureError(id, formatIssues(parsed.error));
  }
  cache.set(id, parsed.data);
  return parsed.data;
}
