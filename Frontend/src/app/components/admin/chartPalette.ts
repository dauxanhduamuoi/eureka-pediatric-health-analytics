/** Category colours only. Risk, error and SHAP sign colours retain their meaning. */
export const ADMIN_CHART_COLORS = [
  '#16a34a', '#0d9488', '#0284c7', '#7c3aed', '#d97706', '#db2777',
  '#15803d', '#0e7490', '#4f46e5', '#a16207', '#be123c', '#64748b',
  '#65a30d', '#c2410c', '#0369a1', '#9d174d', '#166534', '#581c87',
];

export const ADMIN_CHART = {
  primary: ADMIN_CHART_COLORS[0],
  secondary: ADMIN_CHART_COLORS[1],
  grid: '#e5eee8',
  border: '#dcece1',
} as const;

// Carbon light categorical sequence. Keep the legacy palette above for charts
// outside this refinement and keep alert/risk colours separate.
// https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes
export const ADMIN_CATEGORICAL_COLORS = [
  '#6929c4', '#1192e8', '#005d5d', '#9f1853', '#fa4d56', '#570408', '#198038',
  '#002d9c', '#ee538b', '#b28600', '#009d9a', '#012749', '#8a3800', '#a56eff',
] as const;
const LINE_DASHES = ['', '7 3', '2 3', '9 3 2 3', '12 4'] as const;
export interface CategoryStyle { color: string; dash: string }

/** Stable for a reordered category set. Raw names are the available keys in
 * current disease APIs; this is not a global disease-ID registry. Bounded palette
 * repeats for large sets: names, counts and line patterns remain necessary. */
export function categoryStyles(keys: readonly string[]): ReadonlyMap<string, CategoryStyle> {
  return new Map([...new Set(keys)].sort().map((key, index) => [key, {
    color: ADMIN_CATEGORICAL_COLORS[index % ADMIN_CATEGORICAL_COLORS.length],
    dash: LINE_DASHES[index % LINE_DASHES.length],
  }]));
}

export const ADMIN_CHART_TOOLTIP_STYLE = {
  maxWidth: 360, whiteSpace: 'normal', overflowWrap: 'anywhere',
} as const;
