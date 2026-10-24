import { z } from 'zod';
import { EntityIdSchema } from './a2ui.schemas';

/** Lookups the domain schemas need; implemented by the assistant's CRM tools. */
export interface RecordLookup {
  today(): string;
  hasMember(id: string): boolean;
  hasContact(id: string): boolean;
  hasOpenDeal(id: string): boolean;
  dealStage(id: string): string | null;
}

/** Error messages are translation keys, displayed in the visitor's language by the form. */
const optionalRecord = (exists: (id: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .refine((id) => id === '' || (EntityIdSchema.safeParse(id).success && exists(id)), { message });

/**
 * Validates the follow-up form submitted from the A2UI surface before
 * `CrmService.createActivity()` is called. Same rules as the Tasks dialog.
 */
export function followUpInputSchema(lookup: RecordLookup) {
  return z
    .object({
      subject: z.string().trim().min(3, 'validation.subjectLength').max(120, 'validation.subjectLength'),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.required')
        .refine((d) => d >= lookup.today(), 'assistant.validation.pastDate'),
      dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.required'),
      priority: z.enum(['low', 'medium', 'high'], { message: 'validation.required' }),
      ownerId: z.string().refine((id) => lookup.hasMember(id), 'validation.required'),
      contactId: optionalRecord((id) => lookup.hasContact(id), 'assistant.validation.unknownRecord'),
      dealId: optionalRecord((id) => lookup.hasOpenDeal(id), 'assistant.validation.unknownRecord'),
    })
    .strict()
    .refine((input) => input.contactId !== '' || input.dealId !== '', {
      message: 'assistant.validation.linkRecord',
      path: ['contactId'],
    });
}

export type FollowUpInput = z.output<ReturnType<typeof followUpInputSchema>>;

/** Validates a requested stage move before it is shown for confirmation. */
export function moveRequestSchema(lookup: RecordLookup) {
  return z
    .object({
      dealId: z.string().refine((id) => EntityIdSchema.safeParse(id).success && lookup.hasOpenDeal(id), 'assistant.validation.chooseDeal'),
      stage: z.enum(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], { message: 'assistant.validation.chooseStage' }),
    })
    .strict()
    .refine((input) => lookup.dealStage(input.dealId) !== input.stage, {
      message: 'assistant.validation.sameStage',
      path: ['stage'],
    });
}

/** Maps Zod issues to `{ field: translationKey }` for the surface's `/errors` data. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return errors;
}
