import { splitDiseaseLabel } from '@/lib/disease';

export default function DiseaseAxisTick({ x = 0, y = 0, payload, bilingualMap, maxChars = 19 }: {
  x?: number; y?: number; payload?: { value: string }; bilingualMap: Record<string, string>; maxChars?: number;
}) {
  const label = splitDiseaseLabel(String(payload?.value ?? ''), bilingualMap);
  const fullLabel = label.en ? `${label.vi} / ${label.en}` : label.vi;
  const lines: string[] = []; let current = '';
  for (const word of label.vi.split(/\s+/)) {
    if ((current + ' ' + word).trim().length > maxChars && current) { lines.push(current); current = word; }
    else current = (current + ' ' + word).trim();
  }
  if (current) lines.push(current);
  return <text x={x - 5} y={y} textAnchor="end" fontSize={11} fill="currentColor" aria-label={fullLabel}>
    <title>{fullLabel}</title>
    {lines.slice(0, 2).map((line, index) => <tspan key={index} x={x - 5} dy={index === 0 ? (lines.length > 1 ? '-.3em' : '.3em') : '1.2em'}>{line.length > maxChars ? line.slice(0, maxChars - 1) + '…' : line}{index === 1 && lines.length > 2 ? '…' : ''}</tspan>)}
  </text>;
}
