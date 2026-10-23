import type { EChartsCoreOption } from 'echarts/core';
import { MonthlyWon, RevenuePoint, SourceCount, StageSummary } from '../../core/analytics/metrics';
import { ChartOptionsBuilder } from '../../shared/charts/chart';
import {
  animation,
  axisLabelStyle,
  ChartTheme,
  tooltipBase,
  tooltipRow,
  tooltipTitle,
} from '../../shared/charts/chart-theme';
import { Formatters, withAlpha } from '../../shared/charts/chart-utils';

interface AxisParam {
  dataIndex: number;
}

const categoryAxis = (theme: ChartTheme, data: string[], boundaryGap = true) => ({
  type: 'category',
  data,
  inverse: theme.rtl,
  boundaryGap,
  axisLine: { lineStyle: { color: theme.grid } },
  axisTick: { show: false },
  axisLabel: { ...axisLabelStyle(theme), hideOverlap: true, margin: 12 },
});

const valueAxis = (theme: ChartTheme, formatter: (v: number) => string, extra: Record<string, unknown> = {}) => ({
  type: 'value',
  position: theme.rtl ? 'right' : 'left',
  splitNumber: 4,
  splitLine: { lineStyle: { color: theme.grid } },
  axisLabel: { ...axisLabelStyle(theme), formatter },
  ...extra,
});

export interface RevenueLabels {
  current: string;
  previous: string;
  dealsWon: string;
  axis: string[];
  tooltip: string[];
}

/** Area line of closed-won revenue with the previous period dashed behind it. */
export function revenueChart(points: RevenuePoint[], labels: RevenueLabels, fmt: Formatters): ChartOptionsBuilder {
  const hasPrevious = points.some((p) => p.previous > 0);
  return (theme): EChartsCoreOption => {
    const color = theme.series[0];
    return {
      ...animation(theme),
      grid: { top: 12, bottom: 4, left: 4, right: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.border, width: 1 } },
        formatter: (params: AxisParam[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const p = points[i];
          return (
            tooltipTitle(labels.tooltip[i]) +
            tooltipRow(color, labels.current, fmt.money(p.revenue)) +
            (hasPrevious ? tooltipRow(theme.muted, labels.previous, fmt.money(p.previous), true) : '') +
            tooltipRow('transparent', labels.dealsWon, fmt.number(p.dealsWon), true)
          );
        },
      },
      xAxis: categoryAxis(theme, labels.axis, false),
      yAxis: valueAxis(theme, fmt.moneyCompact),
      series: [
        {
          name: labels.previous,
          type: 'line',
          data: hasPrevious ? points.map((p) => p.previous) : [],
          smooth: 0.35,
          smoothMonotone: 'x',
          symbol: 'none',
          lineStyle: { width: 1.5, type: [4, 4], color: theme.muted },
          itemStyle: { color: theme.muted },
          z: 1,
        },
        {
          name: labels.current,
          type: 'line',
          data: points.map((p) => p.revenue),
          smooth: 0.35,
          smoothMonotone: 'x',
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: points.length <= 1,
          lineStyle: { width: 2.25, color },
          itemStyle: { color, borderColor: theme.surface, borderWidth: 2 },
          emphasis: { focus: 'none', scale: 1.2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(color, theme.dark ? 0.32 : 0.2) },
                { offset: 1, color: withAlpha(color, 0) },
              ],
            },
          },
          z: 2,
        },
      ],
    };
  };
}

export interface PipelineLabels {
  stages: string[];
  deals: (count: number) => string;
  value: string;
  weighted: string;
}

/** Horizontal bars of open value per stage, stage-colored (ordinal ramp). */
export function pipelineChart(stages: StageSummary[], labels: PipelineLabels, fmt: Formatters): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid: { top: 4, bottom: 4, left: 4, right: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const s = stages[p.dataIndex];
        return (
          tooltipTitle(labels.stages[p.dataIndex]) +
          tooltipRow(theme.stage[s.stage], labels.value, fmt.money(s.value)) +
          tooltipRow('transparent', labels.weighted, fmt.money(s.weighted), true) +
          `<div style="margin-top:6px;opacity:.7">${labels.deals(s.count)}</div>`
        );
      },
    },
    xAxis: {
      type: 'value',
      inverse: theme.rtl,
      splitNumber: 3,
      splitLine: { lineStyle: { color: theme.grid } },
      axisLabel: { ...axisLabelStyle(theme), formatter: fmt.moneyCompact, hideOverlap: true },
    },
    yAxis: {
      type: 'category',
      data: labels.stages,
      inverse: true,
      position: theme.rtl ? 'right' : 'left',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontFamily: theme.fontFamily, fontSize: 12, margin: 12 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 16,
        showBackground: true,
        backgroundStyle: { color: withAlpha(theme.dark ? '#ffffff' : '#0f1320', 0.035), borderRadius: 4 },
        data: stages.map((s) => ({
          value: s.value,
          itemStyle: { color: theme.stage[s.stage], borderRadius: theme.rtl ? [4, 0, 0, 4] : [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: theme.rtl ? 'left' : 'right',
          color: theme.textMuted,
          fontFamily: theme.fontFamily,
          fontSize: 11,
          formatter: (p: { dataIndex: number }) => String(stages[p.dataIndex].count),
        },
      },
    ],
  });
}

/** Donut of new leads per source. Colors follow the source (fixed order). */
export function sourcesChart(
  sources: SourceCount[],
  labels: { sources: string[]; leads: (n: number) => string },
  fmt: Formatters,
): ChartOptionsBuilder {
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { dataIndex: number; color: string }) => {
        const s = sources[p.dataIndex];
        return (
          tooltipTitle(labels.sources[p.dataIndex]) +
          tooltipRow(p.color, labels.leads(s.count), fmt.percent(total ? s.count / total : 0))
        );
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '88%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
        emphasis: { scale: true, scaleSize: 4 },
        data: sources.map((s, i) => ({ value: s.count, name: labels.sources[i], itemStyle: { color: theme.series[i] } })),
      },
    ],
  });
}

/** Vertical bars: number of deals won per calendar month. */
export function monthlyWonChart(
  rows: MonthlyWon[],
  labels: { axis: string[]; tooltip: string[]; won: string; revenue: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid: { top: 12, bottom: 4, left: 4, right: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(theme.dark ? '#ffffff' : '#0f1320', 0.04) } },
      formatter: (params: AxisParam[]) => {
        const i = params[0]?.dataIndex ?? 0;
        return (
          tooltipTitle(labels.tooltip[i]) +
          tooltipRow(theme.series[0], labels.won, fmt.number(rows[i].won)) +
          tooltipRow('transparent', labels.revenue, fmt.money(rows[i].value), true)
        );
      },
    },
    xAxis: categoryAxis(theme, labels.axis),
    yAxis: valueAxis(theme, fmt.number, { minInterval: 1 }),
    series: [
      {
        type: 'bar',
        barMaxWidth: 26,
        data: rows.map((r) => r.won),
        itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: withAlpha(theme.series[0], 0.85) } },
      },
    ],
  });
}
