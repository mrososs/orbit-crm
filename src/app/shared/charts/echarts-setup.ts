/**
 * Tree-shaken ECharts build. Imported dynamically by the chart container so the
 * library lives in a lazy chunk shared by the dashboard and reports routes.
 */
import { BarChart, FunnelChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  AriaComponent,
  LabelLayout,
  UniversalTransition,
  SVGRenderer,
]);

export { echarts };
