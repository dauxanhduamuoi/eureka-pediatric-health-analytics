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
