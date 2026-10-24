import { AngularCatalog, AngularComponentImplementation } from '@a2ui/angular';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  ButtonApi,
  CardApi,
  ChartApi,
  ColumnApi,
  ConfirmationApi,
  DateFieldApi,
  FormApi,
  GridApi,
  LinkApi,
  MetricApi,
  NoticeApi,
  RecordListApi,
  RowApi,
  SelectFieldApi,
  TextApi,
  TextFieldApi,
} from '../schemas/a2ui.schemas';
import { ORBIT_CATALOG_ID } from '../schemas/constants';
import { A2Button, A2Link, A2Metric, A2Notice, A2Text } from './catalog/content';
import { A2Chart, A2RecordList } from './catalog/data';
import { A2Confirmation, A2DateField, A2Form, A2SelectField, A2TextField } from './catalog/form';
import { A2Card, A2Column, A2Grid, A2Row } from './catalog/layout';
import { createOrbitFunctions } from './orbit-functions';

/**
 * The Orbit component catalog: an allowlist mapping A2UI component names to
 * Orbit design-system components. The renderer only instantiates components
 * registered here, and validates each one's props with its Zod schema.
 */
export const ORBIT_COMPONENTS: AngularComponentImplementation[] = [
  { ...ColumnApi, component: A2Column },
  { ...RowApi, component: A2Row },
  { ...GridApi, component: A2Grid },
  { ...CardApi, component: A2Card },
  { ...TextApi, component: A2Text },
  { ...NoticeApi, component: A2Notice },
  { ...MetricApi, component: A2Metric },
  { ...LinkApi, component: A2Link },
  { ...ButtonApi, component: A2Button },
  { ...ChartApi, component: A2Chart },
  { ...RecordListApi, component: A2RecordList },
  { ...FormApi, component: A2Form },
  { ...TextFieldApi, component: A2TextField },
  { ...SelectFieldApi, component: A2SelectField },
  { ...DateFieldApi, component: A2DateField },
  { ...ConfirmationApi, component: A2Confirmation },
];

export function createOrbitCatalog(language: LanguageService, now: () => Date): AngularCatalog {
  return new AngularCatalog(ORBIT_CATALOG_ID, 'v0.9', ORBIT_COMPONENTS, createOrbitFunctions(language, now));
}
