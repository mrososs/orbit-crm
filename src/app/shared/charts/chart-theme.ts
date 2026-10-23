import { DealStage } from '../../core/models';

/**
 * Resolved chart styling for the current theme + language. Colors are read from
 * the CSS design tokens at render time, so charts always match the UI theme.
 */
export interface ChartTheme {
  series: string[];
  muted: string;
  grid: string;
  axis: string;
  text: string;
  textMuted: string;
  surface: string;
  border: string;
  primary: string;
  success: string;
  danger: string;
  stage: Record<DealStage, string>;
  fontFamily: string;
  rtl: boolean;
  dark: boolean;
  reducedMotion: boolean;
}

export function readChartTheme(doc: Document, rtl: boolean): ChartTheme {
  const root = doc.documentElement;
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--chart-${i}`)),
    muted: v('--chart-muted'),
    grid: v('--chart-grid'),
    axis: v('--chart-axis'),
    text: v('--fg'),
    textMuted: v('--fg-muted'),
    surface: v('--surface'),
    border: v('--border'),
    primary: v('--primary'),
    success: v('--success'),
    danger: v('--danger'),
    stage: {
      new: v('--stage-new'),
      qualified: v('--stage-qualified'),
      proposal: v('--stage-proposal'),
      negotiation: v('--stage-negotiation'),
      won: v('--stage-won'),
      lost: v('--stage-lost'),
    },
    fontFamily: getComputedStyle(doc.body).fontFamily,
    rtl,
    dark: root.classList.contains('dark'),
    reducedMotion:
      root.classList.contains('reduce-motion') ||
      (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  };
}

/** Escapes text inserted into HTML tooltips (names are user data). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Shared tooltip chrome that mirrors Orbit's popovers. */
export function tooltipBase(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: theme.text, fontFamily: theme.fontFamily, fontSize: 12 },
    extraCssText: `border-radius:10px;box-shadow:0 12px 32px -8px rgba(15,19,32,${theme.dark ? 0.6 : 0.18});direction:${theme.rtl ? 'rtl' : 'ltr'};text-align:start;`,
    confine: true,
  };
}

/** One tooltip row: color swatch, label, value — direction-safe. */
export function tooltipRow(color: string, label: string, value: string, muted = false): string {
  return `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;min-width:150px">
    <span style="width:8px;height:8px;border-radius:2px;background:${color};flex:none"></span>
    <span style="flex:1;opacity:${muted ? 0.7 : 0.85}">${escapeHtml(label)}</span>
    <span style="font-weight:600;font-variant-numeric:tabular-nums;unicode-bidi:isolate">${escapeHtml(value)}</span>
  </div>`;
}

export function tooltipTitle(text: string): string {
  return `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(text)}</div>`;
}

export function axisLabelStyle(theme: ChartTheme) {
  return { color: theme.axis, fontFamily: theme.fontFamily, fontSize: 11 };
}

export function animation(theme: ChartTheme) {
  return {
    animation: !theme.reducedMotion,
    animationDuration: 600,
    animationDurationUpdate: 450,
    animationEasing: 'cubicOut' as const,
  };
}
