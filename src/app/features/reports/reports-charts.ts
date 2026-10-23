import type { EChartsCoreOption } from 'echarts/core';
import {
  FunnelStep,
  RepPerformance,
  RevenuePoint,
  SourceInsight,
  StageSummary,
  ValueBandRow,
} from '../../core/analytics/metrics';
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

const grid = { top: 16, bottom: 4, left: 4, right: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' };

const category = (theme: ChartTheme, data: string[]) => ({
  type: 'category',
  data,
  inverse: theme.rtl,
  axisLine: { lineStyle: { color: theme.grid } },
  axisTick: { show: false },
  axisLabel: { ...axisLabelStyle(theme), hideOverlap: true, margin: 12 },
});

const value = (theme: ChartTheme, formatter: (v: number) => string, extra: Record<string, unknown> = {}) => ({
  type: 'value',
  position: theme.rtl ? 'right' : 'left',
  splitNumber: 4,
  splitLine: { lineStyle: { color: theme.grid } },
  axisLabel: { ...axisLabelStyle(theme), formatter },
  ...extra,
});

const legend = (theme: ChartTheme) => ({
  top: 0,
  [theme.rtl ? 'left' : 'right']: 0,
  icon: 'roundRect',
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
  textStyle: { color: theme.textMuted, fontFamily: theme.fontFamily, fontSize: 12 },
});

/** Monthly revenue bars with the previous period as a dashed reference line (same axis). */
export function revenueTrendChart(
  points: RevenuePoint[],
  labels: { axis: string[]; tooltip: string[]; revenue: string; previous: string; won: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  // Omit the comparison series when the previous period has no data at all.
  const hasPrevious = points.some((p) => p.previous > 0);
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid: { ...grid, top: 36 },
    legend: { ...legend(theme), data: hasPrevious ? [labels.revenue, labels.previous] : [labels.revenue] },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(theme.dark ? '#ffffff' : '#0f1320', 0.04) } },
      formatter: (params: AxisParam[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const p = points[i];
        return (
          tooltipTitle(labels.tooltip[i]) +
          tooltipRow(theme.series[0], labels.revenue, fmt.money(p.revenue)) +
          (hasPrevious ? tooltipRow(theme.muted, labels.previous, fmt.money(p.previous), true) : '') +
          tooltipRow('transparent', labels.won, fmt.number(p.dealsWon), true)
        );
      },
    },
    xAxis: category(theme, labels.axis),
    yAxis: value(theme, fmt.moneyCompact),
    series: [
      {
        name: labels.revenue,
        type: 'bar',
        barMaxWidth: 30,
        data: points.map((p) => p.revenue),
        itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
      },
      {
        name: labels.previous,
        type: 'line',
        data: hasPrevious ? points.map((p) => p.previous) : [],
        smooth: 0.3,
        smoothMonotone: 'x',
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 1.5, type: [4, 4], color: theme.muted },
        itemStyle: { color: theme.muted },
      },
    ],
  });
}

/** Total vs. weighted open value per stage (grouped bars, one axis). */
export function pipelineAnalysisChart(
  stages: StageSummary[],
  labels: { stages: string[]; total: string; weighted: string; deals: (n: number) => string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid: { ...grid, top: 36 },
    legend: { ...legend(theme), data: [labels.total, labels.weighted] },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(theme.dark ? '#ffffff' : '#0f1320', 0.04) } },
      formatter: (params: AxisParam[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const s = stages[i];
        return (
          tooltipTitle(labels.stages[i]) +
          tooltipRow(theme.series[0], labels.total, fmt.money(s.value)) +
          tooltipRow(theme.series[5], labels.weighted, fmt.money(s.weighted)) +
          `<div style="margin-top:6px;opacity:.7">${labels.deals(s.count)}</div>`
        );
      },
    },
    xAxis: category(theme, labels.stages),
    yAxis: value(theme, fmt.moneyCompact),
    series: [
      {
        name: labels.total,
        type: 'bar',
        barGap: '12%',
        barMaxWidth: 26,
        data: stages.map((s) => s.value),
        itemStyle: { color: theme.series[0], borderRadius: [4, 4, 0, 0] },
      },
      {
        name: labels.weighted,
        type: 'bar',
        barMaxWidth: 26,
        data: stages.map((s) => s.weighted),
        itemStyle: { color: theme.series[5], borderRadius: [4, 4, 0, 0] },
      },
    ],
  });
}

/** Cohort funnel: share of deals created in the period that reached each stage. */
export function conversionChart(
  steps: FunnelStep[],
  labels: { stages: string[]; reached: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { dataIndex: number; color: string }) => {
        const s = steps[p.dataIndex];
        return tooltipTitle(labels.stages[p.dataIndex]) + tooltipRow(p.color, labels.reached, `${fmt.number(s.count)} · ${fmt.percent(s.rate)}`);
      },
    },
    series: [
      {
        type: 'funnel',
        sort: 'none',
        top: 8,
        bottom: 8,
        left: '6%',
        width: '88%',
        min: 0,
        max: 1,
        minSize: '22%',
        gap: 3,
        label: {
          show: true,
          position: 'inside',
          color: '#fff',
          fontFamily: theme.fontFamily,
          fontSize: 12,
          fontWeight: 500,
          formatter: (p: { dataIndex: number }) => `${labels.stages[p.dataIndex]}  ${fmt.percent(steps[p.dataIndex].rate)}`,
        },
        itemStyle: { borderWidth: 0, borderRadius: 4 },
        emphasis: { label: { fontWeight: 600 } },
        data: steps.map((s, i) => ({
          value: s.rate,
          name: labels.stages[i],
          itemStyle: { color: s.stage === 'won' ? theme.stage.won : theme.stage[s.stage] },
          label: (s.stage === 'new' || s.stage === 'qualified') && !theme.dark ? { color: '#1e1b4b' } : undefined,
        })),
      },
    ],
  });
}

/** Deals created in the period by value band, stacked by outcome. */
export function distributionChart(
  rows: ValueBandRow[],
  labels: { bands: string[]; open: string; won: string; lost: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => {
    const gap = { borderColor: theme.surface, borderWidth: 1 };
    return {
      ...animation(theme),
      grid: { ...grid, top: 36 },
      legend: { ...legend(theme), data: [labels.won, labels.open, labels.lost] },
      tooltip: {
        ...tooltipBase(theme),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(theme.dark ? '#ffffff' : '#0f1320', 0.04) } },
        formatter: (params: AxisParam[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const r = rows[i];
          return (
            tooltipTitle(labels.bands[i]) +
            tooltipRow(theme.stage.won, labels.won, fmt.number(r.won)) +
            tooltipRow(theme.series[0], labels.open, fmt.number(r.open)) +
            tooltipRow(theme.stage.lost, labels.lost, fmt.number(r.lost))
          );
        },
      },
      xAxis: category(theme, labels.bands),
      yAxis: value(theme, fmt.number, { minInterval: 1 }),
      series: [
        { name: labels.won, type: 'bar', stack: 'deals', barMaxWidth: 40, data: rows.map((r) => r.won), itemStyle: { color: theme.stage.won, ...gap } },
        { name: labels.open, type: 'bar', stack: 'deals', data: rows.map((r) => r.open), itemStyle: { color: theme.series[0], ...gap } },
        {
          name: labels.lost,
          type: 'bar',
          stack: 'deals',
          data: rows.map((r) => r.lost),
          itemStyle: { color: theme.stage.lost, borderRadius: [4, 4, 0, 0], ...gap },
        },
      ],
    };
  };
}

/** Horizontal revenue bars per rep. */
export function teamRevenueChart(
  reps: RepPerformance[],
  labels: { names: string[]; revenue: string; quota: string; attainment: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid: { top: 4, bottom: 4, left: 4, right: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const r = reps[p.dataIndex];
        return (
          tooltipTitle(labels.names[p.dataIndex]) +
          tooltipRow(theme.series[0], labels.revenue, fmt.money(r.revenue)) +
          tooltipRow('transparent', labels.quota, fmt.money(r.quota), true) +
          tooltipRow('transparent', labels.attainment, r.attainment === null ? '—' : fmt.percent(r.attainment), true)
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
      data: labels.names,
      inverse: true,
      position: theme.rtl ? 'right' : 'left',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontFamily: theme.fontFamily, fontSize: 12, margin: 10 },
    },
    series: [
      {
        type: 'bar',
        barWidth: 14,
        data: reps.map((r) => ({
          value: r.revenue,
          itemStyle: {
            color: (r.attainment ?? 0) >= 1 ? theme.stage.won : theme.series[0],
            borderRadius: theme.rtl ? [4, 0, 0, 4] : [0, 4, 4, 0],
          },
        })),
      },
    ],
  });
}

/** Revenue by lead source; each source keeps its fixed categorical color. */
export function sourceRevenueChart(
  rows: SourceInsight[],
  labels: { sources: string[]; revenue: string; leads: string; winRate: string },
  fmt: Formatters,
): ChartOptionsBuilder {
  return (theme): EChartsCoreOption => ({
    ...animation(theme),
    grid,
    tooltip: {
      ...tooltipBase(theme),
      trigger: 'item',
      formatter: (p: { dataIndex: number; color: string }) => {
        const r = rows[p.dataIndex];
        return (
          tooltipTitle(labels.sources[p.dataIndex]) +
          tooltipRow(p.color, labels.revenue, fmt.money(r.revenue)) +
          tooltipRow('transparent', labels.leads, fmt.number(r.leads), true) +
          tooltipRow('transparent', labels.winRate, r.winRate === null ? '—' : fmt.percent(r.winRate), true)
        );
      },
    },
    xAxis: category(theme, labels.sources),
    yAxis: value(theme, fmt.moneyCompact),
    series: [
      {
        type: 'bar',
        barMaxWidth: 36,
        data: rows.map((r, i) => ({ value: r.revenue, itemStyle: { color: theme.series[i], borderRadius: [4, 4, 0, 0] } })),
      },
    ],
  });
}
