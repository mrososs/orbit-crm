import { ActivityDeltaEvent, ActivitySnapshotEvent, EventType } from '@ag-ui/core';
import { A2uiComponent, A2uiMessage } from '../schemas/a2ui.schemas';
import { A2UI_ACTIVITY_TYPE, A2UI_VERSION, ORBIT_CATALOG_ID } from '../schemas/constants';

/**
 * A2UI over AG-UI.
 *
 * A2UI defines *what* to render (surfaces, components, data models); AG-UI
 * defines *how* it travels from agent to client. Following the AG-UI A2UI
 * middleware convention, a surface is created with an `ACTIVITY_SNAPSHOT`
 * (`activityType: "a2ui-surface"`, operations under `content.a2ui_operations`)
 * and later operations for the same surface are appended with an
 * `ACTIVITY_DELTA` JSON Patch on that activity message.
 */

export const a2ui = {
  createSurface: (surfaceId: string): A2uiMessage => ({
    version: A2UI_VERSION,
    createSurface: { surfaceId, catalogId: ORBIT_CATALOG_ID },
  }),
  updateComponents: (surfaceId: string, components: A2uiComponent[]): A2uiMessage => ({
    version: A2UI_VERSION,
    updateComponents: { surfaceId, components },
  }),
  /** Without a path the whole data model is replaced. */
  updateDataModel: (surfaceId: string, value: unknown, path?: string): A2uiMessage => ({
    version: A2UI_VERSION,
    updateDataModel: path ? { surfaceId, path, value } : { surfaceId, value },
  }),
  deleteSurface: (surfaceId: string): A2uiMessage => ({ version: A2UI_VERSION, deleteSurface: { surfaceId } }),
};

export function surfaceSnapshot(messageId: string, operations: readonly unknown[]): ActivitySnapshotEvent {
  return {
    type: EventType.ACTIVITY_SNAPSHOT,
    messageId,
    activityType: A2UI_ACTIVITY_TYPE,
    content: { a2ui_operations: operations },
    replace: true,
  };
}

export function surfaceDelta(messageId: string, operations: readonly unknown[]): ActivityDeltaEvent {
  return {
    type: EventType.ACTIVITY_DELTA,
    messageId,
    activityType: A2UI_ACTIVITY_TYPE,
    patch: operations.map((value) => ({ op: 'add' as const, path: '/a2ui_operations/-', value })),
  };
}

/** Surface ids created by an activity's operations. */
export function surfaceIdsOf(content: unknown): string[] {
  const operations = (content as { a2ui_operations?: unknown[] } | null)?.a2ui_operations;
  if (!Array.isArray(operations)) return [];
  return operations
    .map((op) => (op as { createSurface?: { surfaceId?: unknown } })?.createSurface?.surfaceId)
    .filter((id): id is string => typeof id === 'string');
}
