import { z } from 'zod';
import { A2uiComponentSchema } from './a2ui.schemas';

/**
 * A scenario fixture: the A2UI component tree of one surface, stored as JSON in
 * `scenarios/*.json`. The agent sends the components unchanged and hydrates the
 * surface's data model from the CRM stores, keeping UI composition (components)
 * separate from UI data (data model), as A2UI intends.
 */
export const SurfaceFixtureSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
    description: z.string().max(300),
    components: z.array(A2uiComponentSchema).min(1).max(60),
  })
  .strict()
  .superRefine((fixture, ctx) => {
    const ids = new Set<string>();
    for (const component of fixture.components as { id: string }[]) {
      if (ids.has(component.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate component id "${component.id}"` });
      ids.add(component.id);
    }
    if (!ids.has('root')) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A surface needs a "root" component' });
    for (const component of fixture.components) {
      for (const ref of childRefs(component)) {
        if (!ids.has(ref)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${component.id}" references missing component "${ref}"` });
      }
    }
  });

export type SurfaceFixture = z.infer<typeof SurfaceFixtureSchema>;

/** Component ids referenced through `child` / `children` (static lists or templates). */
function childRefs(component: Record<string, unknown>): string[] {
  const refs: string[] = [];
  if (typeof component['child'] === 'string') refs.push(component['child']);
  const children = component['children'];
  if (Array.isArray(children)) refs.push(...children.filter((c): c is string => typeof c === 'string'));
  else if (children && typeof children === 'object' && 'componentId' in children) refs.push(String(children.componentId));
  return refs;
}
