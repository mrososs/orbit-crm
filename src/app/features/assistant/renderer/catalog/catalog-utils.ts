import { A2uiRendererService } from '@a2ui/angular';
import { DataContext } from '@a2ui/web_core/v0_9';
import { z } from 'zod';

/**
 * Resolves an A2UI action against the component's data context and dispatches
 * it through the surface, which hands it to the renderer's `actionHandler`
 * (the assistant's action dispatcher). Components never execute actions.
 */
export function dispatchSurfaceAction(
  renderer: A2uiRendererService,
  surfaceId: string,
  dataContextPath: string,
  componentId: string,
  action: unknown,
): void {
  const surface = renderer.surfaceGroup.getSurface(surfaceId);
  if (!surface || !action) return;
  const context = new DataContext(surface, dataContextPath || '/');
  void surface.dispatchAction(context.resolveAction(action as Parameters<DataContext['resolveAction']>[0]), componentId);
}

/** Parses a data-model value read by a component; invalid data renders as an inline error, never as raw output. */
export function parseData<T>(schema: z.ZodType<T>, value: unknown): { data: T; error: null } | { data: null; error: string } {
  const parsed = schema.safeParse(value ?? []);
  return parsed.success ? { data: parsed.data, error: null } : { data: null, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
}

/** Route for a record link, built from an allowlisted kind and a validated id. */
export function recordRoute(kind: 'deal' | 'contact' | 'company', id: string): string[] {
  const segment = kind === 'company' ? 'companies' : `${kind}s`;
  return ['/', segment, id];
}
