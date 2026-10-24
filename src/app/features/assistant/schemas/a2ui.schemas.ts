import { ChildListSchema, ComponentIdSchema, DataBindingSchema } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import {
  A2UI_VERSION,
  ASSISTANT_ACTIONS,
  ORBIT_CATALOG_ID,
  RECORD_KINDS,
  SURFACE_ICONS,
  SURFACE_PAGES,
  TRANSLATION_NAMESPACES,
} from './constants';

/**
 * Zod schemas for the Orbit A2UI catalog (A2UI v0.9.1 message format).
 *
 * They serve twice: as the component APIs registered with the official
 * `@a2ui/angular` renderer (which validates every component's props), and as the
 * application-boundary allowlist applied to every payload *before* it reaches the
 * renderer — unknown components, functions, actions, catalogs or extra props are
 * rejected instead of being ignored.
 */

// ── Primitives ────────────────────────────────────────────────────────

/** Seeded (`dl_014`) and generated (`ct_9f2c…`) record ids. */
export const EntityIdSchema = z.string().regex(/^[a-z]{2}_[a-z0-9]{1,32}$/, 'Invalid record id');

export const TranslationKeySchema = z
  .string()
  .max(120)
  .regex(new RegExp(`^(${TRANSLATION_NAMESPACES.join('|')})(\\.[A-Za-z0-9-]+)+$`), 'Unknown translation key');

const PlainText = z.string().max(600);
const NumberArg = z.union([z.number(), DataBindingSchema]);
const ret = z.literal('string').optional();

/** Locale-aware formatting functions (they read the active language, so text follows language switches). */
const FormatCallSchema = z.discriminatedUnion('call', [
  z.object({ call: z.literal('formatCurrency'), args: z.object({ value: NumberArg, compact: z.boolean().optional() }).strict(), returnType: ret }).strict(),
  z.object({ call: z.literal('formatNumber'), args: z.object({ value: NumberArg, compact: z.boolean().optional() }).strict(), returnType: ret }).strict(),
  z.object({ call: z.literal('formatPercent'), args: z.object({ value: NumberArg, decimals: z.number().int().min(0).max(2).optional() }).strict(), returnType: ret }).strict(),
  z
    .object({
      call: z.literal('formatDate'),
      args: z.object({ value: z.union([z.string().max(40), DataBindingSchema]), style: z.enum(['medium', 'long', 'full', 'dayMonth', 'dateTime', 'relativeDay']).optional() }).strict(),
      returnType: ret,
    })
    .strict(),
]);

const ParamValue = z.union([z.string().max(200), z.number(), DataBindingSchema, FormatCallSchema]);
const Params = z.record(z.string().regex(/^\w{1,24}$/), ParamValue).optional();
const KeyArg = z.union([TranslationKeySchema, DataBindingSchema]);

/** Client-side functions, each with its own argument schema. Any other `call` is rejected. */
export const OrbitFunctionCallSchema = z.union([
  z.object({ call: z.literal('t'), args: z.object({ key: KeyArg, params: Params }).strict(), returnType: ret }).strict(),
  z.object({ call: z.literal('plural'), args: z.object({ key: KeyArg, count: NumberArg, params: Params }).strict(), returnType: ret }).strict(),
  FormatCallSchema,
]);

export const DynamicTextSchema = z.union([PlainText, DataBindingSchema, OrbitFunctionCallSchema]);
export const DynamicNumberSchema = z.union([z.number(), DataBindingSchema]);
export const DynamicBooleanSchema = z.union([z.boolean(), DataBindingSchema]);
export const IconNameSchema = z.enum(SURFACE_ICONS);
const TestIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** Only server events from the allowlist; client-side `functionCall` actions are not accepted. */
export const OrbitActionSchema = z
  .object({
    event: z
      .object({
        name: z.enum(ASSISTANT_ACTIONS),
        context: z.record(z.string().regex(/^\w{1,32}$/), z.union([z.string().max(200), z.number(), z.boolean(), DataBindingSchema])).optional(),
      })
      .strict(),
  })
  .strict();

const LinkTargetSchema = z.union([
  z.object({ page: z.enum(SURFACE_PAGES) }).strict(),
  z.object({ record: z.object({ kind: z.enum(RECORD_KINDS), id: z.union([EntityIdSchema, DataBindingSchema]) }).strict() }).strict(),
]);

// ── Component APIs ────────────────────────────────────────────────────

export const ColumnApi = {
  name: 'Column',
  schema: z.object({ children: ChildListSchema, gap: z.enum(['sm', 'md', 'lg']).optional() }).strict(),
};

export const RowApi = {
  name: 'Row',
  schema: z.object({ children: ChildListSchema, justify: z.enum(['start', 'between', 'end']).optional() }).strict(),
};

export const GridApi = {
  name: 'Grid',
  schema: z.object({ children: ChildListSchema, columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional() }).strict(),
};

export const TextApi = {
  name: 'Text',
  schema: z
    .object({
      text: DynamicTextSchema,
      variant: z.enum(['title', 'body', 'caption', 'label']).optional(),
      tone: z.enum(['default', 'muted', 'success', 'warning', 'danger']).optional(),
    })
    .strict(),
};

export const CardApi = {
  name: 'Card',
  schema: z
    .object({ child: ComponentIdSchema, title: DynamicTextSchema.optional(), subtitle: DynamicTextSchema.optional(), icon: IconNameSchema.optional() })
    .strict(),
};

export const MetricApi = {
  name: 'Metric',
  schema: z
    .object({
      label: DynamicTextSchema,
      value: DynamicNumberSchema,
      format: z.enum(['currency', 'number', 'percent']),
      hint: DynamicTextSchema.optional(),
      icon: IconNameSchema.optional(),
      /** Relative change (0.12 = +12 %); a null value hides the trend. */
      change: DynamicNumberSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

export const ChartApi = {
  name: 'Chart',
  schema: z
    .object({
      kind: z.enum(['pipelineByStage']),
      data: DataBindingSchema,
      label: DynamicTextSchema,
      height: z.number().int().min(160).max(360).optional(),
    })
    .strict(),
};

export const RecordListApi = {
  name: 'RecordList',
  schema: z
    .object({
      items: DataBindingSchema,
      emptyText: DynamicTextSchema,
      itemAction: z.object({ label: DynamicTextSchema, name: z.enum(['deal.startMove']) }).strict().optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

export const LinkApi = {
  name: 'Link',
  schema: z
    .object({
      label: DynamicTextSchema,
      to: LinkTargetSchema,
      variant: z.enum(['link', 'button']).optional(),
      icon: IconNameSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

export const ButtonApi = {
  name: 'Button',
  schema: z
    .object({
      label: DynamicTextSchema,
      action: OrbitActionSchema,
      variant: z.enum(['primary', 'secondary', 'ghost', 'danger']).optional(),
      icon: IconNameSchema.optional(),
      disabled: DynamicBooleanSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

export const FormApi = {
  name: 'Form',
  schema: z
    .object({
      child: ComponentIdSchema,
      submitLabel: DynamicTextSchema,
      action: OrbitActionSchema,
      cancelLabel: DynamicTextSchema.optional(),
      cancelAction: OrbitActionSchema.optional(),
      /** `editing` | `submitting` | `submitted` | `cancelled`, kept in the data model. */
      status: DataBindingSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

const fieldBase = {
  label: DynamicTextSchema,
  value: DataBindingSchema,
  /** Path to a translation key set by the agent when validation fails. */
  error: DataBindingSchema.optional(),
  hint: DynamicTextSchema.optional(),
  optional: z.boolean().optional(),
  testId: TestIdSchema.optional(),
};

export const TextFieldApi = {
  name: 'TextField',
  schema: z.object({ ...fieldBase, placeholder: DynamicTextSchema.optional(), maxLength: z.number().int().min(1).max(500).optional() }).strict(),
};

export const SelectFieldApi = {
  name: 'SelectField',
  schema: z
    .object({
      ...fieldBase,
      options: DataBindingSchema,
      placeholder: DynamicTextSchema.optional(),
      searchable: z.boolean().optional(),
      /** Dispatched after the value changes (e.g. to refresh a filtered list). */
      action: OrbitActionSchema.optional(),
    })
    .strict(),
};

export const DateFieldApi = {
  name: 'DateField',
  schema: z
    .object({ ...fieldBase, type: z.enum(['date', 'time']).optional(), shortcuts: z.boolean().optional(), minDate: DynamicTextSchema.optional() })
    .strict(),
};

export const ConfirmationApi = {
  name: 'Confirmation',
  schema: z
    .object({
      title: DynamicTextSchema,
      message: DynamicTextSchema,
      confirmLabel: DynamicTextSchema,
      cancelLabel: DynamicTextSchema,
      confirmAction: OrbitActionSchema,
      cancelAction: OrbitActionSchema,
      tone: z.enum(['default', 'danger']).optional(),
      /** Path to a list of {@link DetailSchema} rows shown above the buttons. */
      details: DataBindingSchema.optional(),
      /** `pending` | `confirmed` | `cancelled`, kept in the data model. */
      status: DataBindingSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

export const NoticeApi = {
  name: 'Notice',
  schema: z
    .object({
      tone: z.enum(['success', 'info', 'warning', 'danger']),
      title: DynamicTextSchema,
      message: DynamicTextSchema.optional(),
      testId: TestIdSchema.optional(),
    })
    .strict(),
};

/** Every component the Orbit catalog renders. */
export const ORBIT_COMPONENT_APIS = [
  ColumnApi,
  RowApi,
  GridApi,
  TextApi,
  CardApi,
  MetricApi,
  ChartApi,
  RecordListApi,
  LinkApi,
  ButtonApi,
  FormApi,
  TextFieldApi,
  SelectFieldApi,
  DateFieldApi,
  ConfirmationApi,
  NoticeApi,
] as const;

export type OrbitComponentName = (typeof ORBIT_COMPONENT_APIS)[number]['name'];

// ── Components & messages ─────────────────────────────────────────────

const ComponentKeySchema = z.string().regex(/^[a-z][a-z0-9-]{0,48}$/, 'Invalid component id');

const withEnvelope = <N extends string, S extends z.AnyZodObject>(api: { name: N; schema: S }) =>
  api.schema.extend({ id: ComponentKeySchema, component: z.literal(api.name) });

/** A component definition in an `updateComponents` message, discriminated by `component`. */
export const A2uiComponentSchema = z.discriminatedUnion('component', [
  withEnvelope(ColumnApi),
  withEnvelope(RowApi),
  withEnvelope(GridApi),
  withEnvelope(TextApi),
  withEnvelope(CardApi),
  withEnvelope(MetricApi),
  withEnvelope(ChartApi),
  withEnvelope(RecordListApi),
  withEnvelope(LinkApi),
  withEnvelope(ButtonApi),
  withEnvelope(FormApi),
  withEnvelope(TextFieldApi),
  withEnvelope(SelectFieldApi),
  withEnvelope(DateFieldApi),
  withEnvelope(ConfirmationApi),
  withEnvelope(NoticeApi),
]);
export type A2uiComponent = z.infer<typeof A2uiComponentSchema>;

const SurfaceIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,60}$/, 'Invalid surface id');
const JsonPointerSchema = z.string().max(120).regex(/^(\/[\w-]+)*$/, 'Invalid JSON pointer');
const Version = z.literal(A2UI_VERSION);

/** JSON value with bounded size, so a payload cannot exhaust memory. */
const BoundedJson = z.unknown().refine((value) => {
  try {
    return JSON.stringify(value ?? null).length <= 100_000;
  } catch {
    return false;
  }
}, 'Data model value is too large or not serialisable');

export const CreateSurfaceMessageSchema = z
  .object({
    version: Version,
    createSurface: z.object({ surfaceId: SurfaceIdSchema, catalogId: z.literal(ORBIT_CATALOG_ID), sendDataModel: z.boolean().optional() }).strict(),
  })
  .strict();

export const UpdateComponentsMessageSchema = z
  .object({
    version: Version,
    updateComponents: z.object({ surfaceId: SurfaceIdSchema, components: z.array(A2uiComponentSchema).min(1).max(60) }).strict(),
  })
  .strict();

export const UpdateDataModelMessageSchema = z
  .object({
    version: Version,
    updateDataModel: z.object({ surfaceId: SurfaceIdSchema, path: JsonPointerSchema.optional(), value: BoundedJson.optional() }).strict(),
  })
  .strict();

export const DeleteSurfaceMessageSchema = z
  .object({ version: Version, deleteSurface: z.object({ surfaceId: SurfaceIdSchema }).strict() })
  .strict();

export const A2uiMessageSchema = z.union([
  CreateSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
  DeleteSurfaceMessageSchema,
]);
export type A2uiMessage = z.infer<typeof A2uiMessageSchema>;

/** `content` of an AG-UI `ACTIVITY_SNAPSHOT` whose `activityType` is `a2ui-surface`. */
export const A2uiActivityContentSchema = z.object({ a2ui_operations: z.array(A2uiMessageSchema).min(1).max(40) }).strict();
export type A2uiActivityContent = z.infer<typeof A2uiActivityContentSchema>;

/** `patch` of an AG-UI `ACTIVITY_DELTA`: operations appended to an existing surface. */
export const A2uiActivityPatchSchema = z
  .array(z.object({ op: z.literal('add'), path: z.literal('/a2ui_operations/-'), value: A2uiMessageSchema }).strict())
  .min(1)
  .max(20);

// ── Data model values read by components ─────────────────────────────

export const OptionSchema = z
  .object({
    value: z.string().max(60),
    label: z.string().max(160).optional(),
    labelKey: TranslationKeySchema.optional(),
    description: z.string().max(160).optional(),
  })
  .strict();
export const OptionListSchema = z.array(OptionSchema).max(200);

const LinkRefSchema = z.object({ kind: z.enum(RECORD_KINDS), id: EntityIdSchema, label: z.string().max(160) }).strict();

export const RecordItemSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().max(160),
    subtitle: z.string().max(200).optional(),
    amount: z.number().optional(),
    date: z.string().max(40).optional(),
    dateKind: z.enum(['due', 'close']).optional(),
    overdue: z.boolean().optional(),
    stage: z.enum(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    owner: z.string().max(80).optional(),
    link: LinkRefSchema.optional(),
    related: z.array(LinkRefSchema).max(3).optional(),
  })
  .strict();
export const RecordItemListSchema = z.array(RecordItemSchema).max(50);
export type RecordItem = z.infer<typeof RecordItemSchema>;

export const PipelineChartDataSchema = z
  .array(
    z
      .object({
        stage: z.enum(['new', 'qualified', 'proposal', 'negotiation']),
        count: z.number().int().min(0),
        value: z.number().min(0),
        weighted: z.number().min(0),
      })
      .strict(),
  )
  .max(4);

export const DetailSchema = z
  .object({
    labelKey: TranslationKeySchema,
    value: z.string().max(160).optional(),
    valueKey: TranslationKeySchema.optional(),
    amount: z.number().optional(),
  })
  .strict();
export const DetailListSchema = z.array(DetailSchema).max(8);
